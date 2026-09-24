import { existsSync } from 'node:fs';
import path from 'node:path';
import { type DocumentItem, type DocumentTypeItem, MAX_DOCUMENT_BYTES } from '@ems/contracts';
import request from 'supertest';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { simpleDocx, simplePdf } from '../prisma/sample-files';
import { syncCatalogue } from '../src/catalogue/sync-catalogue';
import { FixedClock } from '../src/common/clock';
import { DocumentExpiryReminders } from '../src/documents/document-expiry';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.8.${(ip = (ip % 250) + 1)}`;
const DHAKA = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`);
const pdf = (name = 'contract.pdf') => ({ content: simplePdf(['Employment contract']), filename: name, contentType: 'application/pdf' });

describeWithDatabase('documents', () => {
  let t: TestApp;
  const clock = new FixedClock(DHAKA('2026-09-17', '09:00'));
  const as = {} as Record<keyof typeof DEMO_PEOPLE, TestBrowser>;
  const types = {} as Record<'nid' | 'passport' | 'contract' | 'certificate', DocumentTypeItem>;
  let ids: { employee: string; hr: string; manager: string };
  /** Every JSON body the API returned, to prove no storage key ever leaves the server. */
  const bodies: unknown[] = [];
  const seen = <T extends { body: unknown }>(res: T): T => {
    bodies.push(res.body);
    return res;
  };

  beforeAll(async () => {
    t = await startTestApp({ clock });
    for (const role of Object.keys(DEMO_PEOPLE) as Array<keyof typeof DEMO_PEOPLE>) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
    const code = async (c: string) => (await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: c } })).id;
    ids = { employee: await code('SX-004'), hr: await code('SX-002'), manager: await code('SX-003') };

    const create = async (body: object) => {
      const res = seen(await as.hr_admin.post('/document-types', body));
      expect(res.status).toBe(201);
      return res.body.data as DocumentTypeItem;
    };
    types.nid = await create({ name: 'National ID', code: 'national_id', isSensitive: true });
    types.passport = await create({ name: 'Passport', code: 'PASSPORT', isSensitive: true, hasExpiry: true });
    types.contract = await create({ name: 'Employment contract', code: 'CONTRACT' });
    types.certificate = await create({ name: 'Certificate', code: 'CERTIFICATE', hasExpiry: true });
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('types', () => {
    it('lists types for everyone, and only document.manage_types changes them', async () => {
      const list = seen(await as.employee.get('/document-types').expect(200)).body.data as DocumentTypeItem[];
      expect(list.map((d) => d.code)).toEqual(['CERTIFICATE', 'CONTRACT', 'NATIONAL_ID', 'PASSPORT']);
      // Organization-wide counts are for the people who manage types
      expect(list.every((d) => d.documentCount === null)).toBe(true);
      const managed = (await as.hr_admin.get('/document-types').expect(200)).body.data as DocumentTypeItem[];
      expect(managed.every((d) => d.documentCount === 0)).toBe(true);
      expect((await as.manager.post('/document-types', { name: 'Visa', code: 'VISA' })).status).toBe(403);
      const duplicate = await as.hr_admin.post('/document-types', { name: 'passport', code: 'PASSPORT' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.errors).toEqual({ name: expect.any(String), code: expect.any(String) });
    });

    it('gives a new permission to the existing roles that should have it by default', async () => {
      await t.prisma.permission.delete({ where: { key: 'document.manage_types' } });
      const summary = await syncCatalogue(t.prisma);
      expect(summary.permissionsAdded).toEqual(['document.manage_types']);
      const grants = await t.prisma.rolePermission.findMany({ where: { permission: { key: 'document.manage_types' } }, select: { scope: true, role: { select: { key: true } } } });
      expect(grants.map((g) => `${g.role.key}:${g.scope}`).sort()).toEqual(['hr_admin:ALL', 'super_admin:ALL']);
      expect((await syncCatalogue(t.prisma)).permissionsAdded).toEqual([]);
    });
  });

  describe('upload', () => {
    let contract: DocumentItem;

    it('stores an employee’s own document under a server-made key, and returns neither the key nor the hash', async () => {
      const res = seen(await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'Signed contract' }, pdf()));
      expect(res.status).toBe(201);
      contract = res.body.data as DocumentItem;
      expect(contract).toMatchObject({ title: 'Signed contract', mimeType: 'application/pdf', expiresAt: null, expiry: null, uploadedBy: 'Rahim Ahmed', allowedActions: { delete: false } });
      expect(Object.keys(contract)).not.toEqual(expect.arrayContaining(['storageKey']));

      const row = await t.prisma.document.findUniqueOrThrow({ where: { id: contract.id } });
      expect(row.storageKey).toMatch(new RegExp(`^employees/${ids.employee}/[0-9a-f-]{36}$`));
      expect(row.storageKey).not.toContain('contract');
      expect(existsSync(path.join(t.storageDir, ...row.storageKey.split('/')))).toBe(true);
      expect(row.sizeBytes).toBe(pdf().content.length);
    });

    it('reads the type from the bytes, not the name or the declared type', async () => {
      const disguised = { content: Buffer.from('MZ\x90\x00 not really a PDF', 'latin1'), filename: 'payslip.pdf', contentType: 'application/pdf' };
      const res = await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'Payslip' }, disguised);
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({ file: 'Upload a PDF, PNG, JPEG or Word (.docx) file' });

      const docx = await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'Offer letter' }, { content: simpleDocx('Offer'), filename: 'offer.bin' });
      expect(docx.status).toBe(201);
      expect(docx.body.data.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('refuses a missing file, a missing expiry date and a file over 10 MB', async () => {
      const missing = await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'Nothing' });
      expect(missing.status).toBe(422);
      expect(missing.body.errors).toEqual({ file: 'Choose a file to upload' });

      const noExpiry = await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.certificate.id, title: 'First aid' }, pdf());
      expect(noExpiry.status).toBe(422);
      expect(noExpiry.body.errors).toEqual({ expiresAt: 'Certificate documents need an expiry date' });

      const big = Buffer.concat([simplePdf(['Big']), Buffer.alloc(MAX_DOCUMENT_BYTES)]);
      const tooBig = await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'Big' }, { content: big, filename: 'big.pdf' });
      expect(tooBig.status).toBe(413);
      expect(tooBig.body.message).toBe('Files can be up to 10 MB');
      // Clearly too big from its declared size: refused before any of it is read
      const huge = Buffer.concat([simplePdf(['Huge']), Buffer.alloc(MAX_DOCUMENT_BYTES + 512 * 1024)]);
      const early = await as.employee.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'Huge' }, { content: huge, filename: 'huge.pdf' });
      expect(early.status).toBe(413);
      expect(early.body.message).toBe('Files can be up to 10 MB');
    });

    it('lets people upload only where their document.upload scope reaches', async () => {
      // An employee can't even tell whether someone else exists
      expect((await as.employee.upload(`/employees/${ids.hr}/documents`, { documentTypeId: types.contract.id, title: 'X' }, pdf())).status).toBe(404);
      // A manager has no document.upload at all
      expect((await as.manager.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.contract.id, title: 'X' }, pdf())).status).toBe(403);
      const hr = seen(await as.hr_admin.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.nid.id, title: 'NID front and back' }, pdf('nid.pdf')));
      expect(hr.status).toBe(201);
      expect(hr.body.data.allowedActions).toEqual({ delete: true });
      expect(await t.prisma.auditLog.count({ where: { action: 'document.uploaded' } })).toBe(3);
    });
  });

  describe('who sees what', () => {
    const titles = (items: DocumentItem[]) => items.map((d) => d.title).sort();

    it('shows an employee all of their own documents, sensitive ones included', async () => {
      const mine = seen(await as.employee.get(`/employees/${ids.employee}/documents`).expect(200)).body.data as DocumentItem[];
      expect(titles(mine)).toEqual(['NID front and back', 'Offer letter', 'Signed contract']);
    });

    it('hides sensitive types from a manager, even for their own report', async () => {
      const team = seen(await as.manager.get(`/employees/${ids.employee}/documents`).expect(200)).body.data as DocumentItem[];
      expect(titles(team)).toEqual(['Offer letter', 'Signed contract']);
      const all = seen(await as.manager.get('/documents').expect(200)).body.data as DocumentItem[];
      expect(all.some((d) => d.documentType.isSensitive)).toBe(false);

      const nid = await t.prisma.document.findFirstOrThrow({ where: { documentTypeId: types.nid.id } });
      expect((await as.manager.get(`/documents/${nid.id}/url`)).status).toBe(404);
    });

    it("answers 404, not 403, for another employee's documents and links", async () => {
      const upload = seen(await as.hr_admin.upload(`/employees/${ids.hr}/documents`, { documentTypeId: types.contract.id, title: 'HR contract' }, pdf()));
      expect(upload.status).toBe(201);
      expect((await as.employee.get(`/employees/${ids.hr}/documents`)).status).toBe(404);
      expect((await as.employee.get(`/documents/${upload.body.data.id}/url`)).status).toBe(404);
      expect((await as.manager.get(`/employees/${ids.hr}/documents`)).status).toBe(404);
      expect((await as.manager.get(`/documents/${upload.body.data.id}/url`)).status).toBe(404);
      const employeeList = seen(await as.employee.get('/documents').expect(200)).body.data as DocumentItem[];
      expect(employeeList.every((d) => d.employee.id === ids.employee)).toBe(true);
    });
  });

  describe('download links', () => {
    let documentId: string;
    let url: string;

    beforeAll(async () => {
      documentId = (await t.prisma.document.findFirstOrThrow({ where: { title: 'Signed contract' } })).id;
    });

    it('gives a 60-second link that downloads the file as an attachment, and audits the access', async () => {
      const res = seen(await as.employee.get(`/documents/${documentId}/url`).expect(200));
      url = res.body.data.url as string;
      expect(res.body.data.expiresAt).toBe(new Date(clock.now().getTime() + 60_000).toISOString());

      const file = await request(t.app.getHttpServer()).get(url).buffer(true).parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      });
      expect(file.status).toBe(200);
      expect(Buffer.compare(file.body as Buffer, pdf().content)).toBe(0);
      expect(file.headers['content-type']).toBe('application/pdf');
      expect(file.headers['content-disposition']).toBe(`attachment; filename="Signed contract.pdf"; filename*=UTF-8''Signed%20contract.pdf`);
      expect(file.headers['cache-control']).toBe('private, no-store');
      expect(file.headers['content-security-policy']).toContain('sandbox');

      expect(await t.prisma.auditLog.count({ where: { action: 'document.accessed', entityId: documentId } })).toBe(1);
    });

    it('stops working after 60 seconds, or when changed', async () => {
      const token = url.split('/').at(-1)!;
      const changed = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
      expect((await request(t.app.getHttpServer()).get(`/api/v1/files/${changed}`)).status).toBe(404);
      clock.set(new Date(clock.now().getTime() + 61_000));
      expect((await request(t.app.getHttpServer()).get(url)).status).toBe(404);
    });
  });

  describe('delete', () => {
    it('is only for document.delete, soft, audited, and keeps the file', async () => {
      const row = await t.prisma.document.findFirstOrThrow({ where: { title: 'Offer letter' } });
      expect((await as.employee.delete(`/documents/${row.id}`)).status).toBe(403);
      expect((await as.manager.delete(`/documents/${row.id}`)).status).toBe(403);
      expect((await as.hr_admin.delete(`/documents/${row.id}`)).status).toBe(204);
      expect((await as.hr_admin.delete(`/documents/${row.id}`)).status).toBe(404);

      expect((await as.employee.get(`/documents/${row.id}/url`)).status).toBe(404);
      const mine = (await as.employee.get(`/employees/${ids.employee}/documents`)).body.data as DocumentItem[];
      expect(mine.map((d) => d.id)).not.toContain(row.id);
      const after = await t.prisma.document.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.deletedAt).not.toBeNull();
      expect(existsSync(path.join(t.storageDir, ...after.storageKey.split('/')))).toBe(true);
      expect(await t.prisma.auditLog.count({ where: { action: 'document.deleted', entityId: row.id } })).toBe(1);
    });

    it("won't delete a type that documents still use", async () => {
      expect((await as.hr_admin.delete(`/document-types/${types.contract.id}`)).status).toBe(409);
      expect((await as.hr_admin.delete(`/document-types/${types.certificate.id}`)).status).toBe(204);
    });
  });

  describe('expiry', () => {
    it('lists expiring and expired documents, most urgent first', async () => {
      clock.set(DHAKA('2026-09-17', '10:00'));
      for (const [title, expiresAt] of [['Passport 2016', '2026-09-10'], ['Passport 2026', '2026-09-24']] as const) {
        const res = await as.hr_admin.upload(`/employees/${ids.employee}/documents`, { documentTypeId: types.passport.id, title, expiresAt }, pdf());
        expect(res.status).toBe(201);
      }
      const expiring = seen(await as.hr_admin.get('/documents?expiry=EXPIRING').expect(200)).body.data as DocumentItem[];
      expect(expiring.map((d) => [d.title, d.expiry])).toEqual([['Passport 2026', 'EXPIRING']]);
      const expired = (await as.hr_admin.get('/documents?expiry=EXPIRED').expect(200)).body.data as DocumentItem[];
      expect(expired.map((d) => [d.title, d.expiry])).toEqual([['Passport 2016', 'EXPIRED']]);
    });

    it('reminds HR and the employee once per stage, never the manager of a sensitive document', async () => {
      const reminders = t.app.get(DocumentExpiryReminders);
      const first = await reminders.run();
      // 7 days left: super admin, HR and the employee each get one
      expect(first.created).toBe(3);
      expect((await reminders.run()).created).toBe(0);

      const rows = await t.prisma.notification.findMany({ select: { title: true, dedupeKey: true, user: { select: { email: true } } }, orderBy: { user: { email: 'asc' } } });
      expect(rows.map((r) => r.user.email)).toEqual([DEMO_PEOPLE.employee.email, DEMO_PEOPLE.hr_admin.email, DEMO_PEOPLE.super_admin.email]);
      expect(rows[0]!.title).toBe('Your Passport expires in 7 days');
      expect(rows[1]!.title).toBe('Passport for Rahim Ahmed expires in 7 days');

      clock.set(DHAKA('2026-09-24', '08:00'));
      expect((await reminders.run()).created).toBe(3);
    });
  });

  it('never returns a storage key or file hash', async () => {
    const keys = (await t.prisma.document.findMany({ select: { storageKey: true, sha256: true } })).flatMap((d) => [d.storageKey, d.sha256]);
    const all = JSON.stringify(bodies);
    expect(bodies.length).toBeGreaterThan(10);
    for (const secret of keys) expect(all).not.toContain(secret);
    expect(all).not.toMatch(/storageKey|sha256|employees\//);
  });
});
