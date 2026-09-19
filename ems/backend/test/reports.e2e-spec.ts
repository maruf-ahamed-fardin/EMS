import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { inflateRawSync } from 'node:zlib';
import { MAX_EXPORT_ROWS, type ReportResponse } from '@ems/contracts';
import { seedDemoActivity } from '../prisma/demo-activity';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { addDays, dateOnly, workingDaysUpTo } from '../src/calendar/work-calendar';
import { DEFAULT_ATTENDANCE_SETTINGS } from '@ems/contracts';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.10.${(ip = (ip % 250) + 1)}`;
type Role = keyof typeof DEMO_PEOPLE;

/** The text of one zip entry (an XLSX part). */
function zipEntry(zip: Buffer, wanted: string): string {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const local = zip.readUInt32LE(offset + 42);
    if (zip.toString('utf8', offset + 46, offset + 46 + nameLength) === wanted) {
      const start = local + 30 + zip.readUInt16LE(local + 26);
      return inflateRawSync(zip.subarray(start, start + size)).toString('utf8');
    }
    offset += 46 + nameLength;
  }
  throw new Error(`${wanted} not in zip`);
}

describeWithDatabase('reports', () => {
  let t: TestApp;
  const as = {} as Record<Role, TestBrowser>;
  const cookies = {} as Record<Role, string>;
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = addDays(today, -30);

  const binary = (req: ReturnType<TestBrowser['get']>) =>
    req.buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

  beforeAll(async () => {
    t = await startTestApp();
    await seedDemoActivity(t.prisma);
    for (const role of Object.keys(DEMO_PEOPLE) as Role[]) {
      as[role] = new TestBrowser(t.app, nextIp());
      const res = await as[role].login(DEMO_PEOPLE[role].email);
      expect(res.status).toBe(200);
      cookies[role] = as[role].sessionCookie(res)!;
    }
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('preview', () => {
    it('shows HR every employee with totals, one page at a time', async () => {
      const res = await as.hr_admin.get('/reports/employees?limit=10').expect(200);
      const report = res.body as ReportResponse;
      const total = await t.prisma.employee.count({ where: { deletedAt: null } });
      expect(report.title).toBe('Employees');
      expect(report.meta).toMatchObject({ total, limit: 10, page: 1 });
      expect(report.data).toHaveLength(10);
      expect(report.columns.map((c) => c.key)).toEqual(['code', 'name', 'department', 'position', 'manager', 'type', 'status', 'joined']);
      expect(report.data[0]).toMatchObject({ code: 'SX-001', name: 'Nusrat Jahan', status: 'Active' });
      expect(report.summary.figures[0]).toEqual({ label: 'Headcount', value: total });
      // Nothing private in a report
      expect(JSON.stringify(report)).not.toMatch(/dateOfBirth|address|emergency|@demo/);
    });

    it("limits a manager to their team and says what was filtered", async () => {
      const team = (await as.manager.get('/reports/employees?limit=100').expect(200)).body as ReportResponse;
      const manager = await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-003' } });
      const expected = await t.prisma.employee.count({ where: { deletedAt: null, OR: [{ id: manager.id }, { managerId: manager.id }] } });
      expect(team.meta.total).toBe(expected);

      const dev = await t.prisma.department.findFirstOrThrow({ where: { code: 'DEV' } });
      const filtered = (await as.hr_admin.get(`/reports/employees?departmentId=${dev.id}&status=ACTIVE`).expect(200)).body as ReportResponse;
      expect(filtered.filters).toEqual([`Department: ${dev.name}`, 'Status: Active']);
    });

    it('builds the attendance, leave and departments reports from the same data the app shows', async () => {
      const attendance = (await as.hr_admin.get(`/reports/attendance?from=${monthAgo}&to=${today}&limit=5`).expect(200)).body as ReportResponse;
      expect(attendance.meta.total).toBe(await t.prisma.attendance.count({ where: { workDate: { gte: dateOnly(monthAgo), lte: dateOnly(today) } } }));
      expect(attendance.summary.figures.map((f) => f.label)).toEqual(['Present rate', 'Late arrivals', 'Absences']);
      expect(attendance.data[0]!.date).toBe(attendance.data[0]!.date?.toString().slice(0, 10));

      const leave = (await as.hr_admin.get(`/reports/leave?from=${addDays(today, -90)}&to=${addDays(today, 60)}`).expect(200)).body as ReportResponse;
      expect(leave.meta.total).toBeGreaterThan(0);
      expect(leave.summary.sections.map((s) => s.title)).toEqual(['Days taken by type', `Days left in ${addDays(today, -90).slice(0, 4)}`, 'By status']);

      const departments = (await as.hr_admin.get(`/reports/departments?from=${addDays(today, -365)}&to=${today}`).expect(200)).body as ReportResponse;
      const active = await t.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } });
      expect(departments.data.reduce((sum, d) => sum + Number(d.active), 0)).toBe(active);
    });

    it('refuses bad filters, unknown reports and people without report.view', async () => {
      const missing = await as.hr_admin.get('/reports/attendance');
      expect(missing.status).toBe(422);
      expect(Object.keys(missing.body.errors)).toEqual(['from', 'to']);
      const tooLong = await as.hr_admin.get('/reports/attendance?from=2025-01-01&to=2026-06-30');
      expect(tooLong.status).toBe(422);
      expect(tooLong.body.errors).toEqual({ to: 'Choose a range of a year or less' });
      expect((await as.hr_admin.get('/reports/salaries')).status).toBe(404);
      expect((await as.employee.get('/reports/employees')).status).toBe(403);
      expect((await as.employee.get('/reports/employees?format=csv')).status).toBe(403);
    });
  });

  describe('exports', () => {
    it('downloads CSV with a byte-order mark, one line per row, and audits it', async () => {
      const res = await binary(as.hr_admin.get(`/reports/attendance?from=${monthAgo}&to=${today}&format=csv`));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(`attachment; filename="attendance-${monthAgo}-to-${today}.csv"`);
      expect(res.headers['cache-control']).toBe('private, no-store');
      const text = (res.body as Buffer).toString('utf8');
      expect(text.startsWith('﻿Date,Employee ID,Employee,Department,In,Out,Hours,Status,Late (min)\r\n')).toBe(true);
      const total = await t.prisma.attendance.count({ where: { workDate: { gte: dateOnly(monthAgo), lte: dateOnly(today) } } });
      expect(text.trimEnd().split('\r\n')).toHaveLength(total + 1);

      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'report.exported' }, orderBy: { createdAt: 'desc' } });
      expect(audit.after).toEqual({ report: 'attendance', format: 'csv', filters: [`Dates: ${monthAgo} to ${today}`], rows: total });
    });

    it('downloads XLSX and PDF for a manager, within their team only', async () => {
      const xlsx = await binary(as.manager.get('/reports/employees?format=xlsx'));
      expect(xlsx.status).toBe(200);
      expect(xlsx.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const sheet = zipEntry(xlsx.body as Buffer, 'xl/worksheets/sheet1.xml');
      const team = await t.prisma.employee.count({ where: { deletedAt: null, OR: [{ employeeCode: 'SX-003' }, { manager: { employeeCode: 'SX-003' } }] } });
      expect(sheet.match(/<row /g)).toHaveLength(team + 1);
      expect(sheet).not.toContain('SX-001');

      const pdf = await binary(as.manager.get('/reports/employees?format=pdf'));
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe(`${MAX_EXPORT_ROWS.toLocaleString('en-US')} rows`, () => {
    let from: string;
    let to: string;
    let rows: number;

    beforeAll(async () => {
      // 150 more people, and a working day's attendance each for most of the year
      const template = await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-010' } });
      await t.prisma.employee.createMany({
        data: Array.from({ length: 150 }, (_, i) => ({
          ...template,
          id: undefined,
          employeeCode: `LD-${String(i).padStart(3, '0')}`,
          email: `load.${i}@load.test`,
          address: template.address ?? {},
          emergencyContact: template.emergencyContact ?? {},
          managerId: null,
          createdAt: undefined,
          updatedAt: undefined,
        })),
      });
      const employees = await t.prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true } });
      to = addDays(today, -40);
      const days = workingDaysUpTo(to, 300, DEFAULT_ATTENDANCE_SETTINGS, new Set());
      await t.prisma.attendance.deleteMany({ where: { workDate: { lte: dateOnly(to) } } });
      for (let i = 0; i < days.length; i += 20) {
        await t.prisma.attendance.createMany({
          data: days.slice(i, i + 20).flatMap((day) => employees.map((e, n) => ({ employeeId: e.id, workDate: dateOnly(day), status: n % 11 === 0 ? ('ABSENT' as const) : ('PRESENT' as const) }))),
        });
      }
      // The longest range that stays within the cap
      from = days[0]!;
      for (const day of days) {
        const count = await t.prisma.attendance.count({ where: { workDate: { gte: dateOnly(day), lte: dateOnly(to) } } });
        if (count <= MAX_EXPORT_ROWS) {
          from = day;
          rows = count;
          break;
        }
      }
      expect(rows).toBeGreaterThan(MAX_EXPORT_ROWS * 0.95);
    }, 300_000);

    it('refuses more than the cap before sending anything, and asks to narrow the range', async () => {
      const res = await as.hr_admin.get(`/reports/attendance?from=${addDays(from, -60)}&to=${to}&format=csv`);
      expect(res.status).toBe(413);
      expect(res.body.message).toMatch(/^This export would have [\d,]+ rows; the limit is 50,000\. Narrow the date range or add a filter\.$/);
    });

    /**
     * Streams every format over a real socket while sampling the API's memory. A report this size held
     * in memory would take well over 100 MB; streamed, it stays within a small ceiling.
     */
    it.each(['csv', 'xlsx', 'pdf'] as const)('streams %s within the memory ceiling', async (format) => {
      const server = t.app.getHttpServer();
      if (!server.listening) await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as AddressInfo).port;

      // Live memory, not garbage waiting for collection: collect before every sample
      setFlagsFromString('--expose-gc');
      const gc = runInNewContext('gc') as () => void;
      const memory = () => {
        gc();
        return process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers;
      };
      const before = memory();
      let peak = before;
      const sampler = setInterval(() => (peak = Math.max(peak, memory())), 50);

      const { status, bytes, lines } = await new Promise<{ status: number; bytes: number; lines: number }>((resolve, reject) => {
        const req = httpRequest(
          { host: '127.0.0.1', port, path: `/api/v1/reports/attendance?from=${from}&to=${to}&format=${format}`, headers: { cookie: `ems_session=${cookies.hr_admin}`, 'x-forwarded-for': nextIp() } },
          (res) => {
            let bytes = 0;
            let lines = 0;
            // Counted and dropped, so only the server's memory is measured
            res.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
              for (const byte of chunk) if (byte === 0x0a) lines++;
            });
            res.on('end', () => resolve({ status: res.statusCode ?? 0, bytes, lines }));
            res.on('error', reject);
          },
        );
        req.on('error', reject);
        req.end();
      });
      clearInterval(sampler);

      expect(status).toBe(200);
      if (format === 'csv') expect(lines).toBe(rows + 1);
      expect(bytes).toBeGreaterThan(rows * 20);
      const grownMb = (peak - before) / 1024 / 1024;
      if (process.env.REPORT_MEMORY_DEBUG) console.log(`${format}: ${rows} rows, ${(bytes / 1024 / 1024).toFixed(1)} MB sent, peak +${grownMb.toFixed(1)} MB`);
      expect(grownMb).toBeLessThan(80);
    }, 300_000);
  });
});
