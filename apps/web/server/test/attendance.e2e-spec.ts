import type { AttendanceItem, AttendanceSummary, MyAttendanceToday } from '@ems/contracts';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { FixedClock } from '../src/common/clock';
import { dateOnly } from '../src/calendar/work-calendar';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.3.${(ip = (ip % 250) + 1)}`;

// Dhaka is UTC+6. 2026-09-17 is a Thursday (working day); 2026-09-18 is a Friday (weekend).
const DHAKA = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`);

describeWithDatabase('attendance', () => {
  let t: TestApp;
  const clock = new FixedClock(DHAKA('2026-09-17', '08:00'));
  const as = {} as Record<keyof typeof DEMO_PEOPLE, TestBrowser>;
  let ids: { employee: string; manager: string; hr: string; sales: string };

  const employeeCode = async (code: string) => (await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: code } })).id;
  const rowFor = (employeeId: string, date: string) =>
    t.prisma.attendance.findUnique({ where: { employeeId_workDate: { employeeId, workDate: dateOnly(date) } } });

  beforeAll(async () => {
    t = await startTestApp({ clock });
    for (const role of Object.keys(DEMO_PEOPLE) as Array<keyof typeof DEMO_PEOPLE>) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
    const sales = await t.prisma.employee.findFirstOrThrow({ where: { department: { code: 'SAL' }, status: 'ACTIVE' } });
    ids = { employee: await employeeCode('SX-004'), manager: await employeeCode('SX-003'), hr: await employeeCode('SX-002'), sales: sales.id };
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('checking in and out', () => {
    it('is on time at 09:15 and records the server time, not a client time', async () => {
      clock.set(DHAKA('2026-09-17', '09:15'));
      const res = await as.employee.post('/attendance/check-in', { occurredAt: '2020-01-01T00:00:00Z' });
      expect(res.status).toBe(200);
      const today = res.body.data as MyAttendanceToday;
      expect(today).toMatchObject({ today: '2026-09-17', isWorkingDay: true, lateAfter: '09:15', canCheckIn: false, canCheckOut: true });
      expect(today.attendance).toMatchObject({ status: 'PRESENT', lateMinutes: 0, firstInAt: '2026-09-17T03:15:00.000Z' });
    });

    it('refuses a second check-in and a check-out before one', async () => {
      const again = await as.employee.post('/attendance/check-in');
      expect(again.status).toBe(409);
      expect(again.body.message).toBe('You have already checked in today');
      expect((await as.manager.post('/attendance/check-out')).status).toBe(409);
    });

    it('is late one minute after the grace period, counting from 09:00', async () => {
      clock.set(DHAKA('2026-09-17', '09:16'));
      const res = await as.manager.post('/attendance/check-in');
      expect(res.body.data.attendance).toMatchObject({ status: 'LATE', lateMinutes: 16 });
    });

    it('checks out once and counts the worked minutes', async () => {
      clock.set(DHAKA('2026-09-17', '17:45'));
      const res = await as.employee.post('/attendance/check-out');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ canCheckIn: false, canCheckOut: false, reason: 'You have checked out for today' });
      expect(res.body.data.attendance.workedMinutes).toBe(8 * 60 + 30);
      expect((await as.employee.post('/attendance/check-out')).body.message).toBe('You have already checked out today');
    });

    it('files a check-in just after midnight in Dhaka under the new day, although UTC is still the day before', async () => {
      // 2026-09-18 00:30 Dhaka = 2026-09-17 18:30 UTC; the 18th is a Friday, so it is never late
      clock.set(DHAKA('2026-09-18', '00:30'));
      const res = await as.hr_admin.post('/attendance/check-in');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ today: '2026-09-18', isWorkingDay: false });
      expect(res.body.data.attendance.status).toBe('PRESENT');
      expect(await rowFor(ids.hr, '2026-09-18')).not.toBeNull();
      expect(await rowFor(ids.hr, '2026-09-17')).toBeNull();
    });

    it('refuses to check in someone on approved leave', async () => {
      const type = await t.prisma.leaveType.create({ data: { name: 'Annual', code: 'ANNUAL', defaultDaysPerYear: 18 } });
      await t.prisma.leaveRequest.create({
        data: { employeeId: ids.employee, leaveTypeId: type.id, startDate: dateOnly('2026-09-20'), endDate: dateOnly('2026-09-20'), days: 1, reason: 'Family', status: 'APPROVED' },
      });
      clock.set(DHAKA('2026-09-20', '09:00'));
      const today = (await as.employee.get('/attendance/today').expect(200)).body.data as MyAttendanceToday;
      expect(today).toMatchObject({ onLeave: true, canCheckIn: false, reason: "You're on approved leave today" });
      const res = await as.employee.post('/attendance/check-in');
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/approved leave/);
    });
  });

  describe('closing a day', () => {
    it('marks absences, leave and weekends once, however many times it runs', async () => {
      clock.set(DHAKA('2026-09-21', '10:00'));
      const first = await as.hr_admin.post('/attendance/close-day', { date: '2026-09-20' });
      expect(first.status).toBe(200);
      expect((await rowFor(ids.employee, '2026-09-20'))?.status).toBe('ON_LEAVE');
      expect((await rowFor(ids.sales, '2026-09-20'))?.status).toBe('ABSENT');

      const again = await as.hr_admin.post('/attendance/close-day', { date: '2026-09-20' });
      expect(again.body.data.created).toBe(0);

      await as.hr_admin.post('/attendance/close-day', { date: '2026-09-18' });
      expect((await rowFor(ids.sales, '2026-09-18'))?.status).toBe('WEEKEND');
      // HR checked in on the Friday; that row is untouched
      expect((await rowFor(ids.hr, '2026-09-18'))?.status).toBe('PRESENT');
    });

    it('closes today only from 23:55', async () => {
      clock.set(DHAKA('2026-09-21', '23:54'));
      expect((await as.hr_admin.post('/attendance/close-day', { date: '2026-09-21' })).status).toBe(422);
      clock.set(DHAKA('2026-09-21', '23:55'));
      expect((await as.hr_admin.post('/attendance/close-day', { date: '2026-09-21' })).status).toBe(200);
    });

    it('closes only the last 7 days by hand, because it marks everyone active today', async () => {
      const old = await as.hr_admin.post('/attendance/close-day', { date: '2026-09-13' });
      expect(old.status).toBe(422);
      expect(old.body.errors.date).toMatch(/last 7 days/);
      expect((await as.hr_admin.post('/attendance/close-day', { date: '2021-03-01' })).status).toBe(422);
    });

    it('turns absences into holidays when a holiday is added afterwards, and back when it is removed', async () => {
      clock.set(DHAKA('2026-09-22', '10:00'));
      const added = await as.hr_admin.post('/holidays', { date: '2026-09-20', name: 'Office closed' });
      expect(added.status).toBe(201);
      expect((await rowFor(ids.sales, '2026-09-20'))?.status).toBe('HOLIDAY');
      // Leave that was approved stays leave
      expect((await rowFor(ids.employee, '2026-09-20'))?.status).toBe('ON_LEAVE');

      expect((await as.hr_admin.delete(`/holidays/${added.body.data.id}`)).status).toBe(204);
      expect((await rowFor(ids.sales, '2026-09-20'))?.status).toBe('ABSENT');
    });
  });

  describe('corrections', () => {
    it('lets HR fix times, re-derives the status and keeps the history', async () => {
      const row = (await rowFor(ids.manager, '2026-09-17'))!;
      const res = await as.hr_admin.patch(`/attendance/${row.id}`, { firstIn: '09:05', lastOut: '18:00', note: 'Badge reader was down' });
      expect(res.status).toBe(200);
      expect(res.body.data as AttendanceItem).toMatchObject({ status: 'PRESENT', lateMinutes: 0, workedMinutes: 535, corrected: true, note: 'Badge reader was down' });

      const records = await t.prisma.attendanceRecord.findMany({ where: { attendanceId: row.id }, orderBy: { createdAt: 'asc' } });
      expect(records.map((r) => r.source)).toEqual(['WEB', 'ADMIN', 'ADMIN']);

      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'attendance.corrected', entityId: row.id } });
      expect(audit.before).toMatchObject({ status: 'LATE', lateMinutes: 16 });
      expect(audit.after).toMatchObject({ status: 'PRESENT', note: 'Badge reader was down' });
    });

    it('refuses times with a no-work status and requires a note', async () => {
      const row = (await rowFor(ids.sales, '2026-09-20'))!;
      expect((await as.hr_admin.patch(`/attendance/${row.id}`, { firstIn: '09:00', lastOut: null, status: 'ABSENT', note: 'x y z' })).status).toBe(422);
      expect((await as.hr_admin.patch(`/attendance/${row.id}`, { firstIn: null, lastOut: null, status: 'ON_LEAVE' })).status).toBe(422);
    });

    it('creates a record for someone who forgot to check in today, once', async () => {
      clock.set(DHAKA('2026-09-22', '11:00'));
      const body = { employeeId: ids.sales, workDate: '2026-09-22', firstIn: '09:40', lastOut: null, note: 'Forgot to check in' };
      const created = await as.hr_admin.post('/attendance', body);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ status: 'LATE', lateMinutes: 40, corrected: true });
      expect((await as.hr_admin.post('/attendance', body)).status).toBe(409);
      expect((await as.hr_admin.post('/attendance', { ...body, workDate: '2026-09-30' })).status).toBe(422);
    });

    it('is not open to managers or employees', async () => {
      const row = (await rowFor(ids.employee, '2026-09-17'))!;
      expect((await as.manager.patch(`/attendance/${row.id}`, { firstIn: '08:00', lastOut: null, note: 'Mine now' })).status).toBe(403);
      expect((await as.employee.patch(`/attendance/${row.id}`, { firstIn: '08:00', lastOut: null, note: 'Mine now' })).status).toBe(403);
    });
  });

  describe('reading', () => {
    it("scopes lists: a manager sees the team, an employee only themselves", async () => {
      const managerList = (await as.manager.get('/attendance?limit=100').expect(200)).body.data as AttendanceItem[];
      const team = new Set((await t.prisma.employee.findMany({ where: { OR: [{ id: ids.manager }, { managerId: ids.manager }] }, select: { id: true } })).map((e) => e.id));
      expect(managerList.length).toBeGreaterThan(0);
      expect(managerList.every((item) => team.has(item.employee.id))).toBe(true);

      const own = (await as.employee.get(`/attendance?employeeId=${ids.sales}`).expect(200)).body.data as AttendanceItem[];
      expect(own).toEqual([]);
    });

    it('summarizes a range like the rows add up', async () => {
      const summary = (await as.hr_admin.get(`/attendance/summary?from=2026-09-17&to=2026-09-22&employeeId=${ids.sales}`).expect(200)).body.data as AttendanceSummary;
      const rows = await t.prisma.attendance.findMany({ where: { employeeId: ids.sales, workDate: { gte: dateOnly('2026-09-17'), lte: dateOnly('2026-09-22') } } });
      expect(Object.values(summary.byStatus).reduce((a, b) => a + b, 0)).toBe(rows.length);
      expect(summary.totalLateMinutes).toBe(rows.reduce((sum, r) => sum + r.lateMinutes, 0));
    });
  });

  describe('settings', () => {
    it('changes the late threshold for new check-ins only', async () => {
      const updated = await as.hr_admin.patch('/settings/attendance', { graceMinutes: 30 });
      expect(updated.status).toBe(200);
      expect(updated.body.data).toMatchObject({ graceMinutes: 30, timeZone: 'Asia/Dhaka', weekendDays: [5] });

      clock.set(DHAKA('2026-09-23', '09:25'));
      const res = await as.manager.post('/attendance/check-in');
      expect(res.body.data).toMatchObject({ lateAfter: '09:30', attendance: { status: 'PRESENT' } });
      // Yesterday's late record keeps its status
      expect((await rowFor(ids.sales, '2026-09-22'))?.status).toBe('LATE');
    });

    it('validates and is restricted to settings.manage', async () => {
      expect((await as.hr_admin.patch('/settings/attendance', { timeZone: 'Mars/Olympus' })).status).toBe(422);
      expect((await as.manager.patch('/settings/attendance', { graceMinutes: 90 })).status).toBe(403);
      expect((await as.employee.post('/holidays', { date: '2026-12-16', name: 'Victory Day' })).status).toBe(403);
      await as.employee.get('/holidays?year=2026').expect(200);
    });
  });
});
