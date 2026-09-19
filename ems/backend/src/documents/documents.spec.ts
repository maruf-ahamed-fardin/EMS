import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { simpleDocx, simplePdf, zipFile } from '../../prisma/sample-files';
import { reminderStage } from './document-expiry';
import { downloadName, expiryOf } from './documents.service';
import { sniffDocumentType } from './sniff';
import { contentDisposition, LocalDocumentStorage } from './storage/storage';

describe('sniffDocumentType', () => {
  it('recognises the four allowed types from their bytes', () => {
    expect(sniffDocumentType(simplePdf(['Hello']))).toBe('application/pdf');
    expect(sniffDocumentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('image/png');
    expect(sniffDocumentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('image/jpeg');
    expect(sniffDocumentType(simpleDocx('Contract'))).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('refuses everything else, whatever it claims to be', () => {
    expect(sniffDocumentType(Buffer.from('MZ\x90\x00 this is a Windows program', 'latin1'))).toBeNull();
    expect(sniffDocumentType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffDocumentType(Buffer.alloc(0))).toBeNull();
    // A zip that isn't a Word document, a macro-enabled one, and a truncated one
    expect(sniffDocumentType(zipFile({ 'readme.txt': 'hi' }))).toBeNull();
    expect(sniffDocumentType(zipFile({ '[Content_Types].xml': 'x', 'word/document.xml': 'x', 'word/vbaProject.bin': 'x' }))).toBeNull();
    expect(sniffDocumentType(simpleDocx('Contract').subarray(0, 60))).toBeNull();
  });
});

describe('LocalDocumentStorage', () => {
  let dir: string;
  let storage: LocalDocumentStorage;
  const now = new Date('2026-09-19T06:00:00Z');
  const key = 'employees/01a0ae57-5047-705c-a435-ecee13af9920/01a0ae57-5047-705c-a435-ecee13af9921';

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ems-storage-'));
    storage = new LocalDocumentStorage(dir);
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('stores a file and opens it through a signed link until it expires', async () => {
    await storage.put(key, Buffer.from('%PDF-1.4 test'));
    const url = await storage.signedUrl(key, { filename: 'Contract.pdf', contentType: 'application/pdf', expiresInSeconds: 60, now });
    expect(url).toMatch(/^\/api\/v1\/files\/[A-Za-z0-9_-]+$/);
    // The link doesn't reveal where the file is kept
    expect(url).not.toContain('employees');
    expect(Buffer.from(url.split('/').at(-1)!, 'base64url').toString('latin1')).not.toContain('employees');

    const token = url.split('/').at(-1)!;
    const file = storage.open(token, new Date(now.getTime() + 59_000));
    expect(file).toMatchObject({ filename: 'Contract.pdf', contentType: 'application/pdf' });
    expect(await readFile(file!.path, 'utf8')).toBe('%PDF-1.4 test');
    expect(storage.open(token, new Date(now.getTime() + 61_000))).toBeNull();
  });

  it('refuses a changed or forged token, and one from another process', async () => {
    const token = (await storage.signedUrl(key, { filename: 'a.pdf', contentType: 'application/pdf', expiresInSeconds: 60, now })).split('/').at(-1)!;
    const raw = Buffer.from(token, 'base64url');
    raw.writeUInt8(raw.readUInt8(raw.length - 1) ^ 1, raw.length - 1);
    expect(storage.open(raw.toString('base64url'), now)).toBeNull();
    expect(storage.open('not-a-token', now)).toBeNull();
    expect(new LocalDocumentStorage(dir).open(token, now)).toBeNull();
  });

  it('only accepts keys the server makes', async () => {
    await expect(storage.put('../outside', Buffer.from('x'))).rejects.toThrow('Invalid storage key');
    await expect(storage.put('employees/../../x', Buffer.from('x'))).rejects.toThrow('Invalid storage key');
    await expect(storage.put('Employees/A', Buffer.from('x'))).rejects.toThrow('Invalid storage key');
  });

  it('deletes, and deleting twice is fine', async () => {
    await storage.delete(key);
    await storage.delete(key);
    const url = await storage.signedUrl(key, { filename: 'a.pdf', contentType: 'application/pdf', expiresInSeconds: 60, now });
    const file = storage.open(url.split('/').at(-1)!, now);
    await expect(readFile(file!.path)).rejects.toThrow();
  });
});

describe('document helpers', () => {
  it('builds a download name that is safe on every system', () => {
    expect(downloadName('Passport: Rahim/Ahmed', 'application/pdf')).toBe('Passport- Rahim-Ahmed.pdf');
    expect(downloadName('  \u0000  ', 'image/png')).toBe('document.png');
    expect(downloadName('জাতীয় পরিচয়পত্র', 'image/jpeg')).toBe('জাতীয় পরিচয়পত্র.jpg');
  });

  it('writes Content-Disposition without letting a name break the header', () => {
    expect(contentDisposition('a"b\\c.pdf')).toBe(`attachment; filename="a_b_c.pdf"; filename*=UTF-8''a%22b%5Cc.pdf`);
    expect(contentDisposition('পাসপোর্ট.pdf')).toMatch(/^attachment; filename="_+\.pdf"; filename\*=UTF-8''%E0/);
  });

  it('says whether a document is expired, expiring within 30 days or fine', () => {
    expect(expiryOf(null, '2026-09-19')).toBeNull();
    expect(expiryOf('2026-09-18', '2026-09-19')).toBe('EXPIRED');
    expect(expiryOf('2026-09-19', '2026-09-19')).toBe('EXPIRING');
    expect(expiryOf('2026-10-19', '2026-09-19')).toBe('EXPIRING');
    expect(expiryOf('2026-10-20', '2026-09-19')).toBe('VALID');
  });

  it('sends the 30, 7 and 0-day reminders, and only the nearest one due', () => {
    expect([31, 30, 8, 7, 1, 0, -1].map(reminderStage)).toEqual([null, 30, 30, 7, 7, 0, null]);
  });
});
