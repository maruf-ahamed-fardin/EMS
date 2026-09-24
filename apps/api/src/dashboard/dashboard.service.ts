import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  type ActivityItem,
  type AttendanceToday,
  type AttendanceTrend,
  type AttendanceTrendPoint,
  can,
  type DashboardOverview,
  type DashboardVariant,
  DOCUMENT_EXPIRY_WARNING_DAYS,
  type MyDay,
  type PendingLeaveItem,
  type TrendRange,
} from '@ems/contracts';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { CalendarService } from '../calendar/calendar.service';
import { Clock } from '../common/clock';
import {
  addDays,
  dateOnly,
  daysBetween,
  isWorkingDay,
  lateAfter,
  monthStart,
  workingDaysUpTo,
  zonedHour,
} from '../calendar/work-calendar';
import { documentVisibleWhere } from '../documents/documents.service';
import { EMPLOYEE_LIST_SELECT, toListItem } from '../employees/employee-view';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardCache } from './dashboard-cache';

const PRESENT_STATUSES = ['PRESENT', 'LATE'] as const;
const EXPECTED_STATUSES = ['PRESENT', 'LATE', 'ABSENT'] as const;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function variantFor(auth: AuthContext): DashboardVariant {
  const scope = auth.permissions['employee.view'];
  if (scope === 'ALL') return 'organization';
  if (scope === 'TEAM') return 'team';
  return 'personal';
}

function name(employee: { firstName: string; lastName: string }): string {
  return `${employee.firstName} ${employee.lastName}`;
}

/**
 * Every number on the dashboard is one query here (plan Phase 5: "every number traced to a query").
 * Everything is scoped with the same ScopeService filters the lists use, so a manager's dashboard can
 * never count people their employee list wouldn't show.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly calendar: CalendarService,
    private readonly cache: DashboardCache,
    private readonly clock: Clock,
  ) {}

  overview(auth: AuthContext, now = this.clock.now()): Promise<DashboardOverview> {
    // Organization numbers are the same for everyone who sees them; team and personal ones aren't
    const variant = variantFor(auth);
    const key = `overview:${variant === 'organization' ? 'org' : auth.user.id}:${auth.permissions['audit.view'] ?? '-'}:${auth.permissions['user.view'] ?? '-'}`;
    return this.cache.getOrCompute(key, () => this.computeOverview(auth, variant, now));
  }

  private async computeOverview(auth: AuthContext, variant: DashboardVariant, now: Date): Promise<DashboardOverview> {
    const settings = await this.calendar.settings();
    const today = await this.calendar.today(now);
    const holidays = await this.calendar.holidaysBetween(today, today);
    const workingDay = isWorkingDay(today, settings, holidays);
    const base: DashboardOverview = {
      variant,
      generatedAt: now.toISOString(),
      today,
      isWorkingDay: workingDay,
      lateAfter: lateAfter(settings),
      headcount: null,
      attendanceToday: null,
      attention: null,
      pendingLeave: [],
      outToday: null,
      newJoiners: [],
      activity: [],
      me: auth.user.employeeId ? await this.myDay(auth.user.employeeId, today) : null,
    };
    if (variant === 'personal') return base;

    const inScope: Prisma.EmployeeWhereInput = { AND: [this.scope.employeeWhere(auth, 'employee.view'), { status: 'ACTIVE' }] };
    const onLeaveToday: Prisma.LeaveRequestWhereInput = {
      status: 'APPROVED',
      startDate: { lte: dateOnly(today) },
      endDate: { gte: dateOnly(today) },
      employee: inScope,
    };

    // People hired but not started yet are on the headcount, but nobody expects them at work
    const [total, started, joinedThisMonth, byDepartment, attendanceGroups, onLeaveRows, newJoiners] = await Promise.all([
      this.prisma.employee.count({ where: inScope }),
      this.prisma.employee.count({ where: { AND: [inScope, { joiningDate: { lte: dateOnly(today) } }] } }),
      this.prisma.employee.count({ where: { AND: [inScope, { joiningDate: { gte: dateOnly(monthStart(today)), lte: dateOnly(today) } }] } }),
      this.prisma.employee.groupBy({ by: ['departmentId'], where: inScope, _count: { _all: true } }),
      this.prisma.attendance.groupBy({ by: ['status'], where: { workDate: dateOnly(today), employee: inScope }, _count: { _all: true } }),
      this.prisma.leaveRequest.findMany({
        where: onLeaveToday,
        distinct: ['employeeId'],
        orderBy: { employeeId: 'asc' },
        select: { employee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.employee.findMany({
        where: { AND: [inScope, { joiningDate: { lte: dateOnly(today) } }] },
        orderBy: [{ joiningDate: 'desc' }, { id: 'asc' }],
        take: 5,
        select: EMPLOYEE_LIST_SELECT,
      }),
    ]);

    const departments = await this.prisma.department.findMany({
      where: { id: { in: byDepartment.map((row) => row.departmentId) } },
      select: { id: true, name: true },
    });
    const departmentName = new Map(departments.map((d) => [d.id, d.name]));

    const countOf = (status: string) => attendanceGroups.find((group) => group.status === status)?._count._all ?? 0;
    const onTime = countOf('PRESENT');
    const late = countOf('LATE');
    const onLeave = onLeaveRows.length;
    const expected = workingDay ? Math.max(started - onLeave, 0) : 0;
    const present = onTime + late;
    const attendanceToday: AttendanceToday = {
      expected,
      present,
      onTime,
      late,
      onLeave,
      notCheckedIn: workingDay ? Math.max(expected - present, 0) : 0,
      presentRate: expected > 0 ? Math.round((present / expected) * 1000) / 1000 : null,
    };

    const [pendingLeave, pendingCount, oldestPending, documentsExpiringSoon, withoutAccount, activity] = await Promise.all([
      this.pendingLeave(auth, 5),
      this.pendingLeaveCount(auth),
      this.oldestPending(auth),
      this.expiringDocuments(auth, today),
      can(auth.permissions, 'user.view') ? this.prisma.employee.count({ where: { AND: [inScope, { user: null }] } }) : Promise.resolve(null),
      this.activity(auth, variant),
    ]);

    return {
      ...base,
      headcount: {
        total,
        joinedThisMonth,
        byDepartment: byDepartment
          .map((row) => ({ departmentId: row.departmentId, name: departmentName.get(row.departmentId) ?? 'Unknown', count: row._count._all }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      },
      attendanceToday,
      attention: {
        pendingLeaveRequests: pendingCount,
        oldestPendingDays: oldestPending ? daysBetween(oldestPending, today) : null,
        notCheckedIn: attendanceToday.notCheckedIn,
        documentsExpiringSoon,
        withoutAccount,
      },
      pendingLeave,
      outToday: { total: onLeave, people: onLeaveRows.slice(0, 8).map((row) => ({ id: row.employee.id, name: name(row.employee) })) },
      newJoiners: newJoiners.map(toListItem),
      activity,
    };
  }

  /** Requests the viewer could act on: in their leave.approve scope, and never their own. */
  private pendingWhere(auth: AuthContext): Prisma.LeaveRequestWhereInput | null {
    if (!can(auth.permissions, 'leave.approve')) return null;
    return {
      status: 'PENDING',
      employee: this.scope.employeeWhere(auth, 'leave.approve'),
      ...(auth.user.employeeId ? { employeeId: { not: auth.user.employeeId } } : {}),
    };
  }

  private async pendingLeave(auth: AuthContext, take: number): Promise<PendingLeaveItem[]> {
    const where = this.pendingWhere(auth);
    if (!where) return [];
    const rows = await this.prisma.leaveRequest.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        days: true,
        createdAt: true,
        leaveType: { select: { name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      employee: { id: row.employee.id, name: name(row.employee) },
      leaveType: row.leaveType.name,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      days: Number(row.days),
      requestedAt: row.createdAt.toISOString(),
    }));
  }

  private async pendingLeaveCount(auth: AuthContext): Promise<number> {
    const where = this.pendingWhere(auth);
    return where ? this.prisma.leaveRequest.count({ where }) : 0;
  }

  private async oldestPending(auth: AuthContext): Promise<string | null> {
    const where = this.pendingWhere(auth);
    if (!where) return null;
    const oldest = await this.prisma.leaveRequest.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    return oldest ? (await this.calendar.today(oldest.createdAt)) : null;
  }

  private expiringDocuments(auth: AuthContext, today: string): Promise<number> {
    if (!can(auth.permissions, 'document.view')) return Promise.resolve(0);
    return this.prisma.document.count({
      where: {
        // Only documents the viewer could open: sensitive ones are never counted for managers
        AND: [documentVisibleWhere(this.scope, auth), { expiresAt: { gte: dateOnly(today), lte: dateOnly(addDays(today, DOCUMENT_EXPIRY_WARNING_DAYS)) } }],
      },
    });
  }

  /**
   * Recent changes. With audit.view: everything except sign-in events. Otherwise (managers): changes
   * to the employees they can see. Values are never included.
   */
  private async activity(auth: AuthContext, variant: DashboardVariant): Promise<ActivityItem[]> {
    let where: Prisma.AuditLogWhereInput;
    if (can(auth.permissions, 'audit.view')) {
      where = { NOT: { action: { startsWith: 'auth.' } } };
    } else if (variant === 'team') {
      const team = await this.prisma.employee.findMany({ where: this.scope.employeeWhere(auth, 'employee.view'), select: { id: true } });
      where = { entityType: 'employee', entityId: { in: team.map((e) => e.id) } };
    } else {
      return [];
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    });
    const employeeIds = rows.filter((r) => r.entityType === 'employee' && r.entityId).map((r) => r.entityId!);
    const subjects = new Map(
      (await this.prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true } })).map((e) => [
        e.id,
        name(e),
      ]),
    );
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor ? (row.actor.employee ? name(row.actor.employee) : row.actor.email) : null,
      entityType: row.entityType,
      entityId: row.entityId,
      subject: row.entityType === 'employee' && row.entityId && subjects.has(row.entityId) ? { id: row.entityId, name: subjects.get(row.entityId)! } : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async myDay(employeeId: string, today: string): Promise<MyDay> {
    const year = Number(today.slice(0, 4));
    const [attendance, onLeave, balances, requests] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { employeeId_workDate: { employeeId, workDate: dateOnly(today) } },
        select: { status: true, firstInAt: true, lastOutAt: true },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: 'APPROVED', startDate: { lte: dateOnly(today) }, endDate: { gte: dateOnly(today) } },
      }),
      this.prisma.leaveBalance.findMany({
        where: { employeeId, year, leaveType: { deletedAt: null, isActive: true } },
        orderBy: { leaveType: { name: 'asc' } },
        select: { allocated: true, carriedForward: true, used: true, pending: true, leaveType: { select: { name: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId, OR: [{ status: 'PENDING' }, { status: 'APPROVED', endDate: { gte: dateOnly(today) } }] },
        orderBy: { startDate: 'asc' },
        take: 5,
        select: { id: true, startDate: true, endDate: true, days: true, status: true, leaveType: { select: { name: true } } },
      }),
    ]);

    return {
      employeeId,
      attendanceToday: attendance
        ? { status: attendance.status, firstInAt: attendance.firstInAt?.toISOString() ?? null, lastOutAt: attendance.lastOutAt?.toISOString() ?? null }
        : null,
      onLeaveToday: onLeave > 0,
      leaveBalances: balances.map((b) => {
        const allocated = Number(b.allocated) + Number(b.carriedForward);
        return { leaveType: b.leaveType.name, allocated, used: Number(b.used), pending: Number(b.pending), available: allocated - Number(b.used) - Number(b.pending) };
      }),
      pendingRequests: requests.map((r) => ({
        id: r.id,
        leaveType: r.leaveType.name,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        days: Number(r.days),
        status: r.status,
      })),
    };
  }

  // ─── Trend ──────────────────────────────────────────────────────────────────────────────────

  trend(auth: AuthContext, range: TrendRange, now = this.clock.now()): Promise<AttendanceTrend> {
    const scope = auth.permissions['attendance.view'];
    if (scope !== 'ALL' && scope !== 'TEAM') throw new ForbiddenException();
    const key = `trend:${range}:${scope === 'ALL' ? 'org' : auth.user.id}`;
    return this.cache.getOrCompute(key, () => this.computeTrend(auth, range, now));
  }

  private async computeTrend(auth: AuthContext, range: TrendRange, now: Date): Promise<AttendanceTrend> {
    const settings = await this.calendar.settings();
    const today = await this.calendar.today(now);
    const employees = this.scope.employeeWhere(auth, 'attendance.view');

    if (range === 'today') {
      const total = await this.prisma.employee.count({ where: { AND: [employees, { status: 'ACTIVE' }, { joiningDate: { lte: dateOnly(today) } }] } });
      const onLeave = await this.prisma.leaveRequest.findMany({
        where: { status: 'APPROVED', startDate: { lte: dateOnly(today) }, endDate: { gte: dateOnly(today) }, employee: employees },
        distinct: ['employeeId'],
        select: { employeeId: true },
      });
      const rows = await this.prisma.attendance.findMany({
        where: { workDate: dateOnly(today), status: { in: [...PRESENT_STATUSES] }, firstInAt: { not: null }, employee: employees },
        select: { firstInAt: true, status: true },
      });
      const expected = Math.max(total - onLeave.length, 0);
      const currentHour = zonedHour(now, settings.timeZone);
      const firstHour = Math.min(7, currentHour);
      const points: AttendanceTrendPoint[] = [];
      for (let hour = firstHour; hour <= currentHour; hour++) {
        const upTo = rows.filter((r) => zonedHour(r.firstInAt!, settings.timeZone) <= hour);
        const label = `${String(hour).padStart(2, '0')}:00`;
        points.push({ key: label, label, expected, present: upTo.length, onTime: upTo.filter((r) => r.status === 'PRESENT').length });
      }
      return { range, points };
    }

    const count = range === 'week' ? 7 : 22;
    const probeStart = addDays(today, -count * 2);
    const holidays = await this.calendar.holidaysBetween(probeStart, today);
    const days = workingDaysUpTo(today, count, settings, holidays);
    const groups = await this.prisma.attendance.groupBy({
      by: ['workDate', 'status'],
      where: { workDate: { gte: dateOnly(days[0] ?? today), lte: dateOnly(today) }, employee: employees },
      _count: { _all: true },
    });
    const byDay = new Map<string, Map<string, number>>();
    for (const group of groups) {
      const day = group.workDate.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, new Map());
      byDay.get(day)!.set(group.status, group._count._all);
    }

    const todayOverview = days.includes(today) ? (await this.overview(auth, now)).attendanceToday : null;
    return {
      range,
      points: days.map((day) => {
        const statuses = byDay.get(day) ?? new Map<string, number>();
        const onTime = statuses.get('PRESENT') ?? 0;
        const present = onTime + (statuses.get('LATE') ?? 0);
        // Past days: everyone with a settled row. Today isn't settled yet, so it uses today's expected count.
        const expected =
          day === today && todayOverview ? todayOverview.expected : EXPECTED_STATUSES.reduce((sum, status) => sum + (statuses.get(status) ?? 0), 0);
        const date = dateOnly(day);
        return {
          key: day,
          label: range === 'week' ? WEEKDAY[date.getUTCDay()]! : `${date.getUTCDate()} ${MONTH[date.getUTCMonth()]}`,
          expected,
          present,
          onTime,
        };
      }),
    };
  }
}
