import type { AttendanceTrend, DashboardOverview, SearchResults } from '@ems/contracts';
import { seedDemoActivity } from '../prisma/demo-activity';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { dateOnly, monthStart, zonedDate } from '../src/calendar/work-calendar';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.2.${(ip = (ip % 250) + 1)}`;

/**
 * Plan Phase 5 gate: "every number traced to a query; seeded values match SQL spot checks". Each
 * expectation below is computed straight from the tables, independently of DashboardService.
 */
describeWithDatabase('dashboard and search', () => {
  let t: TestApp;
  const as = {} as Record<keyof typeof DEMO_PEOPLE, TestBrowser>;
  const today = zonedDate(new Date(), 'Asia/Dhaka');

  beforeAll(async () => {
    t = await startTestApp();
    await seedDemoActivity(t.prisma);
    for (const role of Object.keys(DEMO_PEOPLE) as Array<keyof typeof DEMO_PEOPLE>) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
  }, 240_000);

  afterAll(async () => {
    await t?.close();
  });

  const overviewOf = async (browser: TestBrowser) => (await browser.get('/dashboard/overview').expect(200)).body.data as DashboardOverview;

  describe('organization variant (HR)', () => {
    let overview: DashboardOverview;
    beforeAll(async () => {
      overview = await overviewOf(as.hr_admin);
    });

    it('is the organization variant for today in Dhaka', () => {
      expect(overview).toMatchObject({ variant: 'organization', today, lateAfter: '09:15' });
    });

    it('counts headcount and joiners like the tables do', async () => {
      const active = { deletedAt: null, status: 'ACTIVE' as const };
      expect(overview.headcount!.total).toBe(await t.prisma.employee.count({ where: active }));
      expect(overview.headcount!.joinedThisMonth).toBe(
        await t.prisma.employee.count({ where: { ...active, joiningDate: { gte: dateOnly(monthStart(today)), lte: dateOnly(today) } } }),
      );
      const dev = overview.headcount!.byDepartment.find((d) => d.name === 'Development')!;
      expect(dev.count).toBe(await t.prisma.employee.count({ where: { ...active, department: { code: 'DEV' } } }));
      expect(overview.headcount!.byDepartment.reduce((sum, d) => sum + d.count, 0)).toBe(overview.headcount!.total);
    });

    it("counts today's attendance like the tables do", async () => {
      const day = dateOnly(today);
      const scope = { employee: { deletedAt: null, status: 'ACTIVE' as const } };
      const onTime = await t.prisma.attendance.count({ where: { workDate: day, status: 'PRESENT', ...scope } });
      const late = await t.prisma.attendance.count({ where: { workDate: day, status: 'LATE', ...scope } });
      const onLeave = (
        await t.prisma.leaveRequest.findMany({
          where: { status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day }, ...scope },
          distinct: ['employeeId'],
          select: { employeeId: true },
        })
      ).length;

      // Someone hired to start next month is on the headcount but isn't expected at work yet
      const started = await t.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE', joiningDate: { lte: day } } });

      const a = overview.attendanceToday!;
      expect({ onTime: a.onTime, late: a.late, onLeave: a.onLeave }).toEqual({ onTime, late, onLeave });
      if (overview.isWorkingDay) {
        expect(a.expected).toBe(started - onLeave);
        expect(a.notCheckedIn).toBe(a.expected - a.present);
        expect(a.presentRate).toBeCloseTo(a.present / a.expected, 3);
      } else {
        expect(a.expected).toBe(0);
      }
    });

    it('counts someone hired to start later on the headcount, but not as expected at work', async () => {
      const before = await overviewOf(as.hr_admin);
      const options = (await as.hr_admin.get('/employees/form-options')).body.data;
      const start = new Date(`${today}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() + 20);
      const hire = await as.hr_admin.post('/employees', {
        firstName: 'Future', lastName: 'Starter', dateOfBirth: '1999-01-01', departmentId: options.departments[0].id,
        positionId: options.positions.find((p: { departmentId: string }) => p.departmentId === options.departments[0].id).id,
        joiningDate: start.toISOString().slice(0, 10), employmentType: 'FULL_TIME', workLocation: 'Dhaka office',
        email: 'future.starter@demo.selorax.test', phone: '+8801711000099',
        address: { line1: 'House 9', city: 'Dhaka', country: 'Bangladesh' }, emergencyContact: { name: 'Kin', relationship: 'Brother', phone: '+8801811000099' },
      });
      expect(hire.status).toBe(201);
      const after = await overviewOf(as.hr_admin);
      expect(after.headcount!.total).toBe(before.headcount!.total + 1);
      expect(after.attendanceToday!.expected).toBe(before.attendanceToday!.expected);
      expect(after.attendanceToday!.notCheckedIn).toBe(before.attendanceToday!.notCheckedIn);
      // Out of the way of the counts checked below
      await t.prisma.employee.update({ where: { id: hire.body.data.id }, data: { deletedAt: new Date() } });
    });

    it('lists pending leave oldest first and counts all of it', async () => {
      const hrEmployee = await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-002' } });
      const pending = await t.prisma.leaveRequest.count({ where: { status: 'PENDING', employee: { deletedAt: null }, employeeId: { not: hrEmployee.id } } });
      expect(overview.attention!.pendingLeaveRequests).toBe(pending);
      expect(overview.pendingLeave.length).toBe(Math.min(pending, 5));
      const requested = overview.pendingLeave.map((p) => p.requestedAt);
      expect([...requested].sort()).toEqual(requested);
    });

    it('shows who is out today and the newest joiners', async () => {
      expect(overview.outToday!.total).toBe(overview.attendanceToday!.onLeave);
      const newest = await t.prisma.employee.findFirstOrThrow({
        where: { deletedAt: null, status: 'ACTIVE', joiningDate: { lte: dateOnly(today) } },
        orderBy: [{ joiningDate: 'desc' }, { id: 'asc' }],
      });
      expect(overview.newJoiners[0]?.id).toBe(newest.id);
    });

    it('counts employees without a sign-in account for people who can see accounts', async () => {
      expect(overview.attention!.withoutAccount).toBe(await t.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE', user: null } }));
    });

    it("includes HR's own day", () => {
      // Unpaid leave has no balance
      expect(overview.me?.leaveBalances.map((b) => b.leaveType)).toEqual(['Annual', 'Casual', 'Sick']);
    });
  });

  describe('team variant (manager)', () => {
    it("counts only the manager's team and never their own leave as pending for them", async () => {
      const overview = await overviewOf(as.manager);
      const manager = await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-003' } });
      const team = { deletedAt: null, status: 'ACTIVE' as const, OR: [{ id: manager.id }, { managerId: manager.id }] };

      expect(overview.variant).toBe('team');
      expect(overview.headcount!.total).toBe(await t.prisma.employee.count({ where: team }));
      expect(overview.attention!.withoutAccount).toBeNull();
      expect(overview.attention!.pendingLeaveRequests).toBe(
        await t.prisma.leaveRequest.count({
          where: { status: 'PENDING', employeeId: { not: manager.id }, employee: { deletedAt: null, OR: [{ id: manager.id }, { managerId: manager.id }] } },
        }),
      );
      expect(overview.pendingLeave.every((p) => p.employee.id !== manager.id)).toBe(true);
    });

    it('shows activity only about team members', async () => {
      const hire = await t.prisma.employee.findFirstOrThrow({ where: { department: { code: 'SAL' }, deletedAt: null } });
      await as.hr_admin.patch(`/employees/${hire.id}`, { workLocation: 'Khulna office' });
      const overview = await overviewOf(as.manager);
      expect(overview.activity.some((a) => a.entityId === hire.id)).toBe(false);
    });
  });

  describe('personal variant (employee)', () => {
    it('carries no organization numbers, only their own day', async () => {
      const overview = await overviewOf(as.employee);
      expect(overview).toMatchObject({ variant: 'personal', headcount: null, attendanceToday: null, attention: null, outToday: null, pendingLeave: [], newJoiners: [], activity: [] });

      const me = await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-004' } });
      const balances = await t.prisma.leaveBalance.findMany({ where: { employeeId: me.id, year: Number(today.slice(0, 4)) } });
      const available = balances.reduce((sum, b) => sum + Number(b.allocated) + Number(b.carriedForward) - Number(b.used) - Number(b.pending), 0);
      expect(overview.me!.leaveBalances.reduce((sum, b) => sum + b.available, 0)).toBe(available);
    });

    it('may not read the attendance trend', async () => {
      await as.employee.get('/dashboard/attendance-trend').expect(403);
    });
  });

  describe('attendance trend', () => {
    it('reports each of the last 7 working days from settled attendance rows', async () => {
      const trend = (await as.hr_admin.get('/dashboard/attendance-trend?range=week').expect(200)).body.data as AttendanceTrend;
      expect(trend.points).toHaveLength(7);
      const past = trend.points.find((p) => p.key !== today)!;
      const day = dateOnly(past.key);
      const present = await t.prisma.attendance.count({ where: { workDate: day, status: { in: ['PRESENT', 'LATE'] }, employee: { deletedAt: null } } });
      const expected = await t.prisma.attendance.count({ where: { workDate: day, status: { in: ['PRESENT', 'LATE', 'ABSENT'] }, employee: { deletedAt: null } } });
      expect({ present: past.present, expected: past.expected }).toEqual({ present, expected });
      expect(trend.points.every((p) => p.onTime <= p.present && p.present <= Math.max(p.expected, p.present))).toBe(true);
    });

    it('covers about a month of working days', async () => {
      const trend = (await as.manager.get('/dashboard/attendance-trend?range=month').expect(200)).body.data as AttendanceTrend;
      expect(trend.points).toHaveLength(22);
    });
  });

  describe('cache', () => {
    it('reflects a change at once instead of waiting 30 seconds', async () => {
      const before = (await overviewOf(as.super_admin)).headcount!.total;
      const someone = await t.prisma.employee.findFirstOrThrow({ where: { department: { code: 'MKT' }, status: 'ACTIVE', deletedAt: null, headOf: { none: {} } } });
      expect((await as.hr_admin.post(`/employees/${someone.id}/deactivate`)).status).toBe(200);
      expect((await overviewOf(as.super_admin)).headcount!.total).toBe(before - 1);
    });
  });

  describe('search', () => {
    it('finds people, departments and positions for HR', async () => {
      const res = (await as.hr_admin.get('/search?q=tanvir').expect(200)).body.data as SearchResults;
      expect(res.employees.map((e) => e.employeeCode)).toContain('SX-003');
      const dev = (await as.hr_admin.get('/search?q=dev').expect(200)).body.data as SearchResults;
      expect(dev.departments.map((d) => d.code)).toContain('DEV');
    });

    it("never finds people outside the searcher's scope", async () => {
      const res = (await as.employee.get('/search?q=tanvir').expect(200)).body.data as SearchResults;
      expect(res.employees).toEqual([]);
      const self = (await as.employee.get('/search?q=rahim').expect(200)).body.data as SearchResults;
      expect(self.employees.map((e) => e.employeeCode)).toEqual(['SX-004']);
    });

    it('caps results and needs two characters', async () => {
      const res = (await as.hr_admin.get('/search?q=an').expect(200)).body.data as SearchResults;
      expect(res.employees.length).toBeLessThanOrEqual(5);
      await as.hr_admin.get('/search?q=a').expect(422);
    });
  });
});
