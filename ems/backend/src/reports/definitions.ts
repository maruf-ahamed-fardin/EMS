import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceReportQuery,
  AttendanceStatus,
  type DepartmentsReportQuery,
  EMPLOYEE_STATUS_LABELS,
  type EmployeesReportQuery,
  EMPLOYMENT_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveReportQuery,
  type ReportCell,
  type ReportColumn,
  type ReportKey,
  type ReportSummary,
} from '@ems/contracts';
import type { AuthContext } from '../auth/auth-context';
import type { ScopeService } from '../auth/scope.service';
import { addDays, dateOnly, zonedTime } from '../calendar/work-calendar';
import type { Prisma } from '../generated/prisma/client';
import { available } from '../leave/leave-rules';
import type { PrismaService } from '../prisma/prisma.service';

/** What every report gets: who asks, with which scope, and the parsed filters. */
export interface ReportContext<Q> {
  auth: AuthContext;
  /** `report.view` for the preview, `report.export` for a file. */
  scopeKey: 'report.view' | 'report.export';
  query: Q;
  prisma: PrismaService;
  scope: ScopeService;
  timeZone: string;
}

export interface ReportDefinition<Q> {
  title: string;
  /** `width` is in characters: the XLSX column width, and the share of the PDF page. */
  columns: Array<ReportColumn & { width: number }>;
  /** The filters in words, with names instead of ids. */
  describe(ctx: ReportContext<Q>): Promise<string[]>;
  count(ctx: ReportContext<Q>): Promise<number>;
  /** Rows in column order. Stable order, so batches never skip or repeat a row. */
  rows(ctx: ReportContext<Q>, skip: number, take: number): Promise<ReportCell[][]>;
  summary(ctx: ReportContext<Q>): Promise<ReportSummary>;
}

const iso = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);
const name = (e: { firstName: string; lastName: string } | null | undefined) => (e ? `${e.firstName} ${e.lastName}` : null);
const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`);

function clock(instant: Date | null, timeZone: string): string | null {
  if (!instant) return null;
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(instant);
}

async function departmentName(prisma: PrismaService, id?: string): Promise<string | null> {
  if (!id) return null;
  return (await prisma.department.findUnique({ where: { id }, select: { name: true } }))?.name ?? 'Unknown department';
}

async function employeeName(prisma: PrismaService, id?: string): Promise<string | null> {
  if (!id) return null;
  const e = await prisma.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true, employeeCode: true } });
  return e ? `${e.firstName} ${e.lastName} (${e.employeeCode})` : 'Unknown employee';
}

const range = (q: { from: string; to: string }) => `Dates: ${q.from} to ${q.to}`;

// ─── Employees ──────────────────────────────────────────────────────────────────────────────────

function employeesWhere(ctx: ReportContext<EmployeesReportQuery>): Prisma.EmployeeWhereInput {
  const q = ctx.query;
  return {
    AND: [
      ctx.scope.employeeWhere(ctx.auth, ctx.scopeKey),
      q.departmentId ? { departmentId: q.departmentId } : {},
      q.status ? { status: q.status } : {},
      q.employmentType ? { employmentType: q.employmentType } : {},
      q.joinedFrom || q.joinedTo ? { joiningDate: { ...(q.joinedFrom ? { gte: dateOnly(q.joinedFrom) } : {}), ...(q.joinedTo ? { lte: dateOnly(q.joinedTo) } : {}) } } : {},
    ],
  };
}

export const employeesReport: ReportDefinition<EmployeesReportQuery> = {
  title: 'Employees',
  columns: [
    { key: 'code', label: 'Employee ID', width: 12 },
    { key: 'name', label: 'Name', width: 24 },
    { key: 'department', label: 'Department', width: 18 },
    { key: 'position', label: 'Position', width: 22 },
    { key: 'manager', label: 'Manager', width: 22 },
    { key: 'type', label: 'Type', width: 11 },
    { key: 'status', label: 'Status', width: 10 },
    { key: 'joined', label: 'Joined', width: 12 },
  ],
  async describe({ prisma, query: q }) {
    const department = await departmentName(prisma, q.departmentId);
    return [
      department && `Department: ${department}`,
      q.status && `Status: ${EMPLOYEE_STATUS_LABELS[q.status]}`,
      q.employmentType && `Type: ${EMPLOYMENT_TYPE_LABELS[q.employmentType]}`,
      (q.joinedFrom || q.joinedTo) && `Joined: ${q.joinedFrom ?? 'any time'} to ${q.joinedTo ?? 'now'}`,
    ].filter((f): f is string => Boolean(f));
  },
  count: (ctx) => ctx.prisma.employee.count({ where: employeesWhere(ctx) }),
  async rows(ctx, skip, take) {
    const rows = await ctx.prisma.employee.findMany({
      where: employeesWhere(ctx),
      orderBy: [{ employeeCode: 'asc' }, { id: 'asc' }],
      skip,
      take,
      select: {
        employeeCode: true, firstName: true, lastName: true, employmentType: true, status: true, joiningDate: true,
        department: { select: { name: true } }, position: { select: { title: true } }, manager: { select: { firstName: true, lastName: true } },
      },
    });
    return rows.map((e) => [e.employeeCode, name(e), e.department.name, e.position.title, name(e.manager), EMPLOYMENT_TYPE_LABELS[e.employmentType], EMPLOYEE_STATUS_LABELS[e.status], iso(e.joiningDate)]);
  },
  async summary(ctx) {
    const where = employeesWhere(ctx);
    const [byStatus, byType] = await Promise.all([
      ctx.prisma.employee.groupBy({ by: ['status'], where, _count: { _all: true } }),
      ctx.prisma.employee.groupBy({ by: ['employmentType'], where, _count: { _all: true } }),
    ]);
    const total = byStatus.reduce((sum, g) => sum + g._count._all, 0);
    return {
      figures: [
        { label: 'Headcount', value: total },
        { label: 'Active', value: byStatus.find((g) => g.status === 'ACTIVE')?._count._all ?? 0 },
      ],
      sections: [
        { title: 'By status', rows: byStatus.map((g) => ({ label: EMPLOYEE_STATUS_LABELS[g.status], value: g._count._all })) },
        { title: 'By type', rows: byType.map((g) => ({ label: EMPLOYMENT_TYPE_LABELS[g.employmentType], value: g._count._all })) },
      ],
    };
  },
};

// ─── Attendance ─────────────────────────────────────────────────────────────────────────────────

function attendanceWhere(ctx: ReportContext<AttendanceReportQuery>): Prisma.AttendanceWhereInput {
  const q = ctx.query;
  return {
    AND: [
      { employee: ctx.scope.employeeWhere(ctx.auth, ctx.scopeKey) },
      { workDate: { gte: dateOnly(q.from), lte: dateOnly(q.to) } },
      q.departmentId ? { employee: { departmentId: q.departmentId } } : {},
      q.employeeId ? { employeeId: q.employeeId } : {},
      q.status ? { status: q.status } : {},
    ],
  };
}

export const attendanceReport: ReportDefinition<AttendanceReportQuery> = {
  title: 'Attendance',
  columns: [
    { key: 'date', label: 'Date', width: 12 },
    { key: 'code', label: 'Employee ID', width: 12 },
    { key: 'employee', label: 'Employee', width: 24 },
    { key: 'department', label: 'Department', width: 18 },
    { key: 'in', label: 'In', width: 8 },
    { key: 'out', label: 'Out', width: 8 },
    { key: 'hours', label: 'Hours', width: 8, numeric: true },
    { key: 'status', label: 'Status', width: 11 },
    { key: 'lateMinutes', label: 'Late (min)', width: 10, numeric: true },
  ],
  async describe({ prisma, query: q }) {
    const [department, employee] = await Promise.all([departmentName(prisma, q.departmentId), employeeName(prisma, q.employeeId)]);
    return [range(q), department && `Department: ${department}`, employee && `Employee: ${employee}`, q.status && `Status: ${ATTENDANCE_STATUS_LABELS[q.status]}`].filter(
      (f): f is string => Boolean(f),
    );
  },
  count: (ctx) => ctx.prisma.attendance.count({ where: attendanceWhere(ctx) }),
  async rows(ctx, skip, take) {
    const rows = await ctx.prisma.attendance.findMany({
      where: attendanceWhere(ctx),
      orderBy: [{ workDate: 'asc' }, { employee: { employeeCode: 'asc' } }, { id: 'asc' }],
      skip,
      take,
      select: {
        workDate: true, firstInAt: true, lastOutAt: true, workedMinutes: true, status: true, lateMinutes: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
      },
    });
    return rows.map((a) => [
      iso(a.workDate),
      a.employee.employeeCode,
      name(a.employee),
      a.employee.department.name,
      clock(a.firstInAt, ctx.timeZone),
      clock(a.lastOutAt, ctx.timeZone),
      a.lastOutAt ? Math.round((a.workedMinutes / 60) * 10) / 10 : null,
      ATTENDANCE_STATUS_LABELS[a.status],
      a.lateMinutes > 0 ? a.lateMinutes : null,
    ]);
  },
  async summary(ctx) {
    const where = attendanceWhere(ctx);
    const [groups, absences] = await Promise.all([
      ctx.prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
      ctx.prisma.attendance.groupBy({ by: ['employeeId'], where: { AND: [where, { status: 'ABSENT' }] }, _count: { _all: true }, orderBy: { _count: { employeeId: 'desc' } }, take: 5 }),
    ]);
    const count = Object.fromEntries(AttendanceStatus.map((s) => [s, groups.find((g) => g.status === s)?._count._all ?? 0])) as Record<AttendanceStatus, number>;
    const present = count.PRESENT + count.LATE;
    const people = await ctx.prisma.employee.findMany({ where: { id: { in: absences.map((a) => a.employeeId) } }, select: { id: true, firstName: true, lastName: true } });
    return {
      figures: [
        { label: 'Present rate', value: percent(present, present + count.ABSENT) },
        { label: 'Late arrivals', value: count.LATE },
        { label: 'Absences', value: count.ABSENT },
      ],
      sections: [
        { title: 'By status', rows: AttendanceStatus.filter((s) => count[s] > 0).map((s) => ({ label: ATTENDANCE_STATUS_LABELS[s], value: count[s] })) },
        ...(absences.length > 0
          ? [{ title: 'Most absences', rows: absences.map((a) => ({ label: name(people.find((p) => p.id === a.employeeId)) ?? 'Unknown', value: a._count._all })) }]
          : []),
      ],
    };
  },
};

// ─── Leave ──────────────────────────────────────────────────────────────────────────────────────

function leaveWhere(ctx: ReportContext<LeaveReportQuery>): Prisma.LeaveRequestWhereInput {
  const q = ctx.query;
  return {
    AND: [
      { employee: ctx.scope.employeeWhere(ctx.auth, ctx.scopeKey) },
      // Any leave that overlaps the range
      { startDate: { lte: dateOnly(q.to) }, endDate: { gte: dateOnly(q.from) } },
      q.departmentId ? { employee: { departmentId: q.departmentId } } : {},
      q.employeeId ? { employeeId: q.employeeId } : {},
      q.status ? { status: q.status } : {},
      q.leaveTypeId ? { leaveTypeId: q.leaveTypeId } : {},
    ],
  };
}

export const leaveReport: ReportDefinition<LeaveReportQuery> = {
  title: 'Leave',
  columns: [
    { key: 'code', label: 'Employee ID', width: 12 },
    { key: 'employee', label: 'Employee', width: 22 },
    { key: 'department', label: 'Department', width: 16 },
    { key: 'type', label: 'Type', width: 12 },
    { key: 'from', label: 'From', width: 12 },
    { key: 'to', label: 'To', width: 12 },
    { key: 'days', label: 'Days', width: 7, numeric: true },
    { key: 'status', label: 'Status', width: 10 },
    { key: 'reviewer', label: 'Reviewed by', width: 20 },
  ],
  async describe({ prisma, query: q }) {
    const [department, employee, type] = await Promise.all([
      departmentName(prisma, q.departmentId),
      employeeName(prisma, q.employeeId),
      q.leaveTypeId ? prisma.leaveType.findUnique({ where: { id: q.leaveTypeId }, select: { name: true } }) : null,
    ]);
    return [
      range(q),
      department && `Department: ${department}`,
      employee && `Employee: ${employee}`,
      type && `Type: ${type.name}`,
      q.status && `Status: ${LEAVE_STATUS_LABELS[q.status]}`,
    ].filter((f): f is string => Boolean(f));
  },
  count: (ctx) => ctx.prisma.leaveRequest.count({ where: leaveWhere(ctx) }),
  async rows(ctx, skip, take) {
    const rows = await ctx.prisma.leaveRequest.findMany({
      where: leaveWhere(ctx),
      orderBy: [{ startDate: 'asc' }, { employee: { employeeCode: 'asc' } }, { id: 'asc' }],
      skip,
      take,
      select: {
        startDate: true, endDate: true, days: true, status: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        leaveType: { select: { name: true } },
        reviewedBy: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    });
    return rows.map((r) => [
      r.employee.employeeCode,
      name(r.employee),
      r.employee.department.name,
      r.leaveType.name,
      iso(r.startDate),
      iso(r.endDate),
      Number(r.days),
      LEAVE_STATUS_LABELS[r.status],
      r.reviewedBy ? (name(r.reviewedBy.employee) ?? r.reviewedBy.email) : null,
    ]);
  },
  /** Days taken per type in the filtered requests, and what the same people have left this year. */
  async summary(ctx) {
    const where = leaveWhere(ctx);
    const year = Number(ctx.query.from.slice(0, 4));
    const [taken, byStatus, types, balances] = await Promise.all([
      ctx.prisma.leaveRequest.groupBy({ by: ['leaveTypeId'], where: { AND: [where, { status: 'APPROVED' }] }, _sum: { days: true } }),
      ctx.prisma.leaveRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
      ctx.prisma.leaveType.findMany({ select: { id: true, name: true } }),
      ctx.prisma.leaveBalance.findMany({
        where: {
          year,
          employee: ctx.scope.employeeWhere(ctx.auth, ctx.scopeKey),
          ...(ctx.query.departmentId ? { employee: { AND: [ctx.scope.employeeWhere(ctx.auth, ctx.scopeKey), { departmentId: ctx.query.departmentId }] } } : {}),
          ...(ctx.query.employeeId ? { employeeId: ctx.query.employeeId } : {}),
          ...(ctx.query.leaveTypeId ? { leaveTypeId: ctx.query.leaveTypeId } : {}),
        },
        select: { leaveTypeId: true, allocated: true, carriedForward: true, used: true, pending: true },
      }),
    ]);
    const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? 'Unknown';
    const remaining = new Map<string, number>();
    for (const b of balances) {
      const left = available({ allocated: Number(b.allocated), carriedForward: Number(b.carriedForward), used: Number(b.used), pending: Number(b.pending) });
      remaining.set(b.leaveTypeId, (remaining.get(b.leaveTypeId) ?? 0) + left);
    }
    const totalTaken = taken.reduce((sum, t) => sum + Number(t._sum.days ?? 0), 0);
    return {
      figures: [
        { label: 'Requests', value: byStatus.reduce((sum, g) => sum + g._count._all, 0) },
        { label: 'Days taken (approved)', value: totalTaken },
      ],
      sections: [
        { title: 'Days taken by type', rows: taken.map((t) => ({ label: typeName(t.leaveTypeId), value: Number(t._sum.days ?? 0) })) },
        { title: `Days left in ${year}`, rows: [...remaining].map(([id, left]) => ({ label: typeName(id), value: left })) },
        { title: 'By status', rows: byStatus.map((g) => ({ label: LEAVE_STATUS_LABELS[g.status], value: g._count._all })) },
      ],
    };
  },
};

// ─── Departments ────────────────────────────────────────────────────────────────────────────────

interface DepartmentRow {
  code: string;
  name: string;
  head: string | null;
  headcount: number;
  active: number;
  joined: number;
  left: number;
}

/**
 * One row per department, counting only the employees in the viewer's scope; a department with none
 * of them is left out, so a manager sees their own team's departments.
 */
async function departmentRows(ctx: ReportContext<DepartmentsReportQuery>): Promise<DepartmentRow[]> {
  const scoped = ctx.scope.employeeWhere(ctx.auth, ctx.scopeKey);
  const from = dateOnly(ctx.query.from);
  // Leaving is a moment, so the range runs from midnight to midnight in the organization's time zone
  const leftFrom = zonedTime(ctx.query.from, '00:00', ctx.timeZone);
  const leftUntil = zonedTime(addDays(ctx.query.to, 1), '00:00', ctx.timeZone);
  const [departments, all, active, joined, left] = await Promise.all([
    ctx.prisma.department.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, head: { select: { firstName: true, lastName: true } } } }),
    ctx.prisma.employee.groupBy({ by: ['departmentId'], where: scoped, _count: { _all: true } }),
    ctx.prisma.employee.groupBy({ by: ['departmentId'], where: { AND: [scoped, { status: 'ACTIVE' }] }, _count: { _all: true } }),
    ctx.prisma.employee.groupBy({ by: ['departmentId'], where: { AND: [scoped, { joiningDate: { gte: from, lte: dateOnly(ctx.query.to) } }] }, _count: { _all: true } }),
    ctx.prisma.employee.groupBy({ by: ['departmentId'], where: { AND: [scoped, { deactivatedAt: { gte: leftFrom, lt: leftUntil } }] }, _count: { _all: true } }),
  ]);
  const of = (groups: Array<{ departmentId: string; _count: { _all: number } }>, id: string) => groups.find((g) => g.departmentId === id)?._count._all ?? 0;
  return departments
    .map((d) => ({ code: d.code, name: d.name, head: name(d.head), headcount: of(all, d.id), active: of(active, d.id), joined: of(joined, d.id), left: of(left, d.id) }))
    .filter((d) => d.headcount > 0 || ctx.auth.permissions[ctx.scopeKey] === 'ALL');
}

export const departmentsReport: ReportDefinition<DepartmentsReportQuery> = {
  title: 'Departments',
  columns: [
    { key: 'code', label: 'Code', width: 8 },
    { key: 'department', label: 'Department', width: 22 },
    { key: 'head', label: 'Head', width: 22 },
    { key: 'headcount', label: 'Headcount', width: 11, numeric: true },
    { key: 'active', label: 'Active', width: 9, numeric: true },
    { key: 'joined', label: 'Joined in period', width: 15, numeric: true },
    { key: 'left', label: 'Left in period', width: 14, numeric: true },
  ],
  describe: ({ query }) => Promise.resolve([range(query)]),
  count: async (ctx) => (await departmentRows(ctx)).length,
  async rows(ctx, skip, take) {
    return (await departmentRows(ctx)).slice(skip, skip + take).map((d) => [d.code, d.name, d.head, d.headcount, d.active, d.joined, d.left]);
  },
  async summary(ctx) {
    const rows = await departmentRows(ctx);
    const active = rows.reduce((sum, d) => sum + d.active, 0);
    return {
      figures: [
        { label: 'Departments', value: rows.length },
        { label: 'Active employees', value: active },
        { label: 'Joined', value: rows.reduce((sum, d) => sum + d.joined, 0) },
        { label: 'Left', value: rows.reduce((sum, d) => sum + d.left, 0) },
      ],
      sections: [{ title: 'Share of active employees', rows: rows.filter((d) => d.active > 0).map((d) => ({ label: d.name, value: percent(d.active, active) })) }],
    };
  },
};

export const REPORTS: { [K in ReportKey]: ReportDefinition<never> } = {
  employees: employeesReport,
  attendance: attendanceReport,
  leave: leaveReport,
  departments: departmentsReport,
};
