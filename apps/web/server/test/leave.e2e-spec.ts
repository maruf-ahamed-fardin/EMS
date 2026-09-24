import type { LeaveBalanceRow, LeavePreview, LeaveRequestItem, LeaveTypeItem } from '@ems/contracts';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { FixedClock } from '../src/common/clock';
import { dateOnly } from '../src/calendar/work-calendar';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.4.${(ip = (ip % 250) + 1)}`;
const DHAKA = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`);

// 2026-09: Fridays are 18 and 25; October Fridays are 2, 9, 16, 23, 30.
describeWithDatabase('leave', () => {
  let t: TestApp;
  const clock = new FixedClock(DHAKA('2026-09-17', '09:00'));
  const as = {} as Record<keyof typeof DEMO_PEOPLE, TestBrowser>;
  let annual: LeaveTypeItem;
  let ids: { employee: string; hr: string; manager: string };

  const balance = async (employeeId: string, leaveTypeId: string, year = 2026) =>
    t.prisma.leaveBalance.findUniqueOrThrow({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } } });

  beforeAll(async () => {
    t = await startTestApp({ clock });
    for (const role of Object.keys(DEMO_PEOPLE) as Array<keyof typeof DEMO_PEOPLE>) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
    const code = async (c: string) => (await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: c } })).id;
    ids = { employee: await code('SX-004'), hr: await code('SX-002'), manager: await code('SX-003') };

    const created = await as.hr_admin.post('/leave/types', { name: 'Annual', code: 'annual', defaultDaysPerYear: 18, carryForwardMax: 5 });
    expect(created.status).toBe(201);
    annual = created.body.data as LeaveTypeItem;
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('types and balances', () => {
    it("gives everyone this year's balance when a paid type is created", async () => {
      const mine = (await as.employee.get('/leave/balances').expect(200)).body.data as LeaveBalanceRow[];
      expect(mine).toEqual([expect.objectContaining({ leaveType: expect.objectContaining({ code: 'ANNUAL' }), allocated: 18, available: 18, year: 2026 })]);
      const active = await t.prisma.employee.count({ where: { status: 'ACTIVE', deletedAt: null } });
      expect(await t.prisma.leaveBalance.count({ where: { leaveTypeId: annual.id, year: 2026 } })).toBe(active);
    });

    it('prorates the balance for someone who joins mid-year', async () => {
      const options = (await as.hr_admin.get('/employees/form-options')).body.data;
      const dev = options.departments.find((d: { code: string }) => d.code === 'DEV');
      const position = options.positions.find((p: { departmentId: string }) => p.departmentId === dev.id);
      const hire = await as.hr_admin.post('/employees', {
        firstName: 'July', lastName: 'Joiner', dateOfBirth: '1998-01-01', departmentId: dev.id, positionId: position.id, joiningDate: '2026-07-01',
        employmentType: 'FULL_TIME', workLocation: 'Dhaka office', email: 'july.joiner@demo.selorax.test', phone: '+8801711000001',
        address: { line1: 'House 1', city: 'Dhaka', country: 'Bangladesh' }, emergencyContact: { name: 'Kin', relationship: 'Sister', phone: '+8801811000001' },
      });
      expect(hire.status).toBe(201);
      // 18 × 184/365 = 9.07 → rounded down to 9
      expect(Number((await balance(hire.body.data.id, annual.id)).allocated)).toBe(9);
    });

    it('lets HR adjust a balance with a reason, but never below what is committed', async () => {
      const row = await balance(ids.manager, annual.id);
      const res = await as.hr_admin.patch(`/leave/balances/${row.id}`, { allocated: 20, note: 'Long service' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ allocated: 20, available: 20 });
      expect((await as.manager.patch(`/leave/balances/${row.id}`, { allocated: 30, note: 'Mine' })).status).toBe(403);
    });

    it("carries what is left of a year into the next, capped, but only once the year is over", async () => {
      // A December request still pending at the turn of the year
      const december = await as.manager.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-12-28', endDate: '2026-12-29', reason: 'Year end' });
      expect(december.status).toBe(201);

      // Made early, next year's balance carries nothing yet: this year isn't over
      const res = await as.hr_admin.post('/leave/balances/allocate', { year: 2027 });
      expect(res.status).toBe(200);
      expect(await balance(ids.manager, annual.id, 2027)).toMatchObject({ carryForwardSettled: false });
      expect(Number((await balance(ids.manager, annual.id, 2027)).carriedForward)).toBe(0);
      expect((await as.hr_admin.post('/leave/balances/allocate', { year: 2027 })).body.data.created).toBe(0);
      expect((await as.hr_admin.post('/leave/balances/allocate', { year: 2030 })).status).toBe(403);

      // The rest of 2026 is spent after that: 20 allocated, 16 used, 2 pending leaves 2 to carry
      await t.prisma.leaveBalance.update({ where: { id: (await balance(ids.manager, annual.id)).id }, data: { used: 16 } });
      clock.set(DHAKA('2027-01-03', '10:00'));
      try {
        expect((await as.hr_admin.post('/leave/balances/allocate', { year: 2027 })).status).toBe(200);
        expect(await balance(ids.manager, annual.id, 2027)).toMatchObject({ carryForwardSettled: true });
        expect(Number((await balance(ids.manager, annual.id, 2027)).carriedForward)).toBe(2);

        // Rejecting the December request in January gives its days back to 2027 as well
        expect((await as.hr_admin.patch(`/leave/requests/${december.body.data.id}/reject`, { note: 'Too late' })).status).toBe(200);
        expect(Number((await balance(ids.manager, annual.id, 2027)).carriedForward)).toBe(4);
      } finally {
        clock.set(DHAKA('2026-09-17', '09:00'));
        await t.prisma.leaveBalance.update({ where: { id: (await balance(ids.manager, annual.id)).id }, data: { used: 0 } });
      }
    });
  });

  describe('requesting', () => {
    let request: LeaveRequestItem;

    it('previews working days, skipping weekends and holidays', async () => {
      await as.hr_admin.post('/holidays', { date: '2026-09-27', name: 'Office closed' });
      const res = await as.employee.post('/leave/preview', { leaveTypeId: annual.id, startDate: '2026-09-24', endDate: '2026-09-28' });
      expect(res.status).toBe(200);
      const preview = res.body.data as LeavePreview;
      expect(preview).toMatchObject({ days: 3, workingDays: ['2026-09-24', '2026-09-26', '2026-09-28'], available: 18, availableAfter: 15, problems: [] });
      expect(preview.excludedDays).toEqual([
        { date: '2026-09-25', reason: 'Friday' },
        { date: '2026-09-27', reason: 'Office closed' },
      ]);
    });

    it('requests leave and reserves the days', async () => {
      const res = await as.employee.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-09-24', endDate: '2026-09-28', reason: 'Family visit' });
      expect(res.status).toBe(201);
      request = res.body.data as LeaveRequestItem;
      expect(request).toMatchObject({ status: 'PENDING', days: 3, allowedActions: { approve: false, cancel: true } });
      expect(Number((await balance(ids.employee, annual.id)).pending)).toBe(3);
    });

    it('refuses overlaps, empty ranges, past dates and more than the balance', async () => {
      const post = (body: object) => as.employee.post('/leave/requests', { leaveTypeId: annual.id, reason: 'Again', ...body });
      expect((await post({ startDate: '2026-09-28', endDate: '2026-09-29' })).body.message).toMatch(/already have leave/);
      expect((await post({ startDate: '2026-09-25', endDate: '2026-09-25' })).body.message).toMatch(/weekends or holidays/);
      expect((await post({ startDate: '2026-09-10', endDate: '2026-09-10' })).body.message).toMatch(/past/);
      expect((await post({ startDate: '2026-10-01', endDate: '2026-10-31' })).body.message).toMatch(/15 days of Annual leave left/);
    });

    it('never lets parallel requests overdraw a balance', async () => {
      await t.prisma.leaveBalance.update({ where: { id: (await balance(ids.hr, annual.id)).id }, data: { allocated: 10 } });
      // Three non-overlapping 4-working-day requests against 10 days: only two can fit
      const ranges = [
        ['2026-10-04', '2026-10-07'],
        ['2026-10-11', '2026-10-14'],
        ['2026-10-18', '2026-10-21'],
      ];
      const results = await Promise.all(
        ranges.map(([startDate, endDate]) => as.hr_admin.post('/leave/requests', { leaveTypeId: annual.id, startDate, endDate, reason: 'Trips' })),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 201, 409]);
      const hrBalance = await balance(ids.hr, annual.id);
      expect(Number(hrBalance.pending)).toBe(8);
    });

    it('keeps balances right when a type switches between paid and unpaid while requests are open', async () => {
      const flip = (await as.hr_admin.post('/leave/types', { name: 'Study', code: 'STUDY', defaultDaysPerYear: 5 })).body.data as LeaveTypeItem;
      const paid = await as.employee.post('/leave/requests', { leaveTypeId: flip.id, startDate: '2026-11-15', endDate: '2026-11-16', reason: 'Exam' });
      expect(paid.status).toBe(201);
      expect(Number((await balance(ids.employee, flip.id)).pending)).toBe(2);

      // Now unpaid: the open request still gives its reserved days back
      expect((await as.hr_admin.patch(`/leave/types/${flip.id}`, { isPaid: false })).status).toBe(200);
      const unpaidRequest = await as.employee.post('/leave/requests', { leaveTypeId: flip.id, startDate: '2026-11-17', endDate: '2026-11-17', reason: 'Exam' });
      expect(unpaidRequest.status).toBe(201);
      expect((await as.hr_admin.patch(`/leave/requests/${paid.body.data.id}/reject`, { note: 'Not this time' })).status).toBe(200);
      expect(Number((await balance(ids.employee, flip.id)).pending)).toBe(0);

      // Paid again: the request made while unpaid never touched a balance, so deciding it can't break one
      expect((await as.hr_admin.patch(`/leave/types/${flip.id}`, { isPaid: true })).status).toBe(200);
      expect((await as.hr_admin.patch(`/leave/requests/${unpaidRequest.body.data.id}/reject`, { note: 'Not this time' })).status).toBe(200);
      expect(await balance(ids.employee, flip.id)).toMatchObject({ pending: expect.anything() });
      expect(Number((await balance(ids.employee, flip.id)).pending)).toBe(0);
      expect((await as.hr_admin.patch(`/leave/types/${flip.id}`, { isActive: false })).status).toBe(200);
    });

    it('does not use a balance for unpaid leave', async () => {
      const unpaid = (await as.hr_admin.post('/leave/types', { name: 'Unpaid', code: 'UNPAID', defaultDaysPerYear: 0, isPaid: false })).body.data as LeaveTypeItem;
      const res = await as.employee.post('/leave/requests', { leaveTypeId: unpaid.id, startDate: '2026-11-01', endDate: '2026-11-02', reason: 'Personal' });
      expect(res.status).toBe(201);
      expect(res.body.data.balanceAvailable).toBeNull();
    });
  });

  describe('deciding', () => {
    it('lets the manager approve a team member, marks recorded days as leave and moves pending to used', async () => {
      const [pending] = (await as.manager.get('/leave/requests?reviewable=true').expect(200)).body.data as LeaveRequestItem[];
      expect(pending).toMatchObject({ employee: { id: ids.employee }, allowedActions: { approve: true, reject: true } });
      await t.prisma.attendance.create({ data: { employeeId: ids.employee, workDate: dateOnly('2026-09-24'), status: 'ABSENT' } });

      const [first, second] = await Promise.all([
        as.manager.patch(`/leave/requests/${pending!.id}/approve`, {}),
        as.manager.patch(`/leave/requests/${pending!.id}/approve`, {}),
      ]);
      expect([first.status, second.status].sort()).toEqual([200, 409]);

      const b = await balance(ids.employee, annual.id);
      expect({ pending: Number(b.pending), used: Number(b.used) }).toEqual({ pending: 0, used: 3 });
      const row = await t.prisma.attendance.findUniqueOrThrow({ where: { employeeId_workDate: { employeeId: ids.employee, workDate: dateOnly('2026-09-24') } } });
      expect(row.status).toBe('ON_LEAVE');
    });

    it("never lets anyone decide their own leave, and hides other teams' requests", async () => {
      const [own] = (await as.hr_admin.get('/leave/requests?mine=true&status=PENDING').expect(200)).body.data as LeaveRequestItem[];
      const res = await as.hr_admin.patch(`/leave/requests/${own!.id}/approve`, {});
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/your own/);
      // HR is not in the manager's team
      expect((await as.manager.patch(`/leave/requests/${own!.id}/approve`, {})).status).toBe(404);
      expect((await as.employee.get(`/leave/requests/${own!.id}`)).status).toBe(404);
    });

    it('rejects with a reason and releases the days', async () => {
      const [own] = (await as.hr_admin.get('/leave/requests?mine=true&status=PENDING').expect(200)).body.data as LeaveRequestItem[];
      expect((await as.super_admin.patch(`/leave/requests/${own!.id}/reject`, { note: '' })).status).toBe(422);
      const res = await as.super_admin.patch(`/leave/requests/${own!.id}/reject`, { note: 'Busy month' });
      expect(res.body.data).toMatchObject({ status: 'REJECTED', reviewNote: 'Busy month' });
      expect(Number((await balance(ids.hr, annual.id)).pending)).toBe(4);
    });

    it('cancels pending and upcoming leave, but not leave that has started', async () => {
      const [own] = (await as.hr_admin.get('/leave/requests?mine=true&status=PENDING').expect(200)).body.data as LeaveRequestItem[];
      expect((await as.hr_admin.patch(`/leave/requests/${own!.id}/cancel`, {})).body.data.status).toBe('CANCELLED');
      expect(Number((await balance(ids.hr, annual.id)).pending)).toBe(0);

      const approved = (await as.employee.get('/leave/requests?mine=true&status=APPROVED').expect(200)).body.data as LeaveRequestItem[];
      clock.set(DHAKA('2026-09-24', '10:00'));
      const started = await as.employee.patch(`/leave/requests/${approved[0]!.id}/cancel`, {});
      expect(started.status).toBe(409);
      expect(started.body.message).toMatch(/already started/);
      clock.set(DHAKA('2026-09-17', '09:00'));
      expect((await as.employee.patch(`/leave/requests/${approved[0]!.id}/cancel`, {})).status).toBe(200);
      expect(Number((await balance(ids.employee, annual.id)).used)).toBe(0);
    });

    it('audits every step without extra details', async () => {
      const actions = (await t.prisma.auditLog.findMany({ where: { entityType: 'leave_request' }, select: { action: true } })).map((a) => a.action);
      expect(new Set(actions)).toEqual(new Set(['leave.requested', 'leave.approved', 'leave.rejected', 'leave.cancelled']));
    });
  });

  describe('check-in on approved leave', () => {
    it('is refused', async () => {
      const req = await as.manager.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-09-17', endDate: '2026-09-17', reason: 'Doctor' });
      expect(req.status).toBe(201);
      expect((await as.super_admin.patch(`/leave/requests/${req.body.data.id}/approve`, {})).status).toBe(200);
      expect((await as.manager.post('/attendance/check-in')).status).toBe(409);
    });
  });
});
