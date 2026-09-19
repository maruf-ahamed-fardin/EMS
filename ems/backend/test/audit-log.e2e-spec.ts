import type { AuditDetail, AuditListItem } from '@ems/contracts';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.11.${(ip = (ip % 250) + 1)}`;
type Role = keyof typeof DEMO_PEOPLE;

describeWithDatabase('audit log viewer', () => {
  let t: TestApp;
  const as = {} as Record<Role, TestBrowser>;
  let auditor: TestBrowser;
  let employeeId: string;
  let hrUserId: string;

  beforeAll(async () => {
    t = await startTestApp();
    for (const role of Object.keys(DEMO_PEOPLE) as Role[]) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
    employeeId = (await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-004' } })).id;
    hrUserId = (await t.prisma.user.findUniqueOrThrow({ where: { email: DEMO_PEOPLE.hr_admin.email } })).id;

    // A role that may read the audit log but not employees' private details
    const permission = await t.prisma.permission.findUniqueOrThrow({ where: { key: 'audit.view' } });
    const role = await t.prisma.role.create({ data: { key: 'auditor', name: 'Auditor', permissions: { create: { permissionId: permission.id, scope: 'ALL' } } } });
    const template = await t.prisma.user.findUniqueOrThrow({ where: { email: DEMO_PEOPLE.employee.email } });
    await t.prisma.user.create({ data: { email: 'auditor@demo.selorax.test', passwordHash: template.passwordHash, roleId: role.id } });
    auditor = new TestBrowser(t.app, nextIp());
    expect((await auditor.login('auditor@demo.selorax.test')).status).toBe(200);

    // Something to find: HR changes the employee's phone and address
    const res = await as.hr_admin.patch(`/employees/${employeeId}`, { phone: '+8801711999888', address: { line1: 'House 7, Road 3', city: 'Dhaka', country: 'Bangladesh' } });
    expect(res.status).toBe(200);
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  it('lists the history of one record, newest first, with who did it and which fields changed', async () => {
    const res = await as.hr_admin.get(`/audit-logs?entityType=employee&entityId=${employeeId}`).expect(200);
    const [latest] = res.body.data as AuditListItem[];
    expect(latest).toMatchObject({
      action: 'employee.updated',
      entityType: 'employee',
      entityId: employeeId,
      entityLabel: 'Rahim Ahmed (SX-004)',
      actor: { id: hrUserId, name: 'Farhana Akter', email: DEMO_PEOPLE.hr_admin.email },
      changedFields: ['address', 'phone'],
    });
    // Values are only in the detail
    expect(JSON.stringify(res.body.data)).not.toContain('8801711999888');
  });

  it('shows what each field was and became', async () => {
    const [latest] = (await as.hr_admin.get(`/audit-logs?entityId=${employeeId}&action=employee.updated`).expect(200)).body.data as AuditListItem[];
    const detail = (await as.hr_admin.get(`/audit-logs/${latest!.id}`).expect(200)).body.data as AuditDetail;
    const phone = detail.changes.find((c) => c.field === 'phone')!;
    expect(phone.after).toBe('+8801711999888');
    expect(phone.before).not.toBe('+8801711999888');
    expect(detail.changes.find((c) => c.field === 'address')).toMatchObject({ after: { line1: 'House 7, Road 3', city: 'Dhaka' } });
    expect(detail.requestId).toEqual(expect.any(String));
  });

  it("hides private employee values from someone who couldn't see them on the profile", async () => {
    const [latest] = (await auditor.get(`/audit-logs?entityId=${employeeId}&action=employee.updated`).expect(200)).body.data as AuditListItem[];
    const detail = (await auditor.get(`/audit-logs/${latest!.id}`).expect(200)).body.data as AuditDetail;
    expect(detail.changes.find((c) => c.field === 'address')).toEqual({ field: 'address', before: null, after: null, hidden: true });
    expect(detail.changes.find((c) => c.field === 'phone')!.after).toBe('+8801711999888');
    expect(JSON.stringify(detail)).not.toContain('House 7');
  });

  it('filters by action, person and day', async () => {
    const logins = (await as.hr_admin.get('/audit-logs?action=auth.login&limit=100').expect(200)).body.data as AuditListItem[];
    expect(logins.length).toBeGreaterThanOrEqual(5);
    expect(logins.every((l) => l.action === 'auth.login')).toBe(true);

    const byHr = (await as.hr_admin.get(`/audit-logs?actorUserId=${hrUserId}&limit=100`).expect(200)).body.data as AuditListItem[];
    expect(byHr.length).toBeGreaterThan(0);
    expect(byHr.every((l) => l.actor?.id === hrUserId)).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    expect((await as.hr_admin.get(`/audit-logs?from=2020-01-01&to=2020-12-31`).expect(200)).body.meta.total).toBe(0);
    expect((await as.hr_admin.get(`/audit-logs?from=${today}&to=${today}`).expect(200)).body.meta.total).toBeGreaterThan(0);
  });

  it('is only for audit.view, and answers 404 for anything unknown', async () => {
    expect((await as.manager.get('/audit-logs')).status).toBe(403);
    expect((await as.employee.get('/audit-logs')).status).toBe(403);
    expect((await as.hr_admin.get('/audit-logs/not-an-id')).status).toBe(404);
    expect((await as.hr_admin.get('/audit-logs/01a0ae57-5047-705c-a435-ecee13af9999')).status).toBe(404);
  });
});
