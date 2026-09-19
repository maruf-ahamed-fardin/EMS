import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  type AttendanceItem,
  type AttendanceListQuery,
  AttendanceStatus,
  type AttendanceSummary,
  type CorrectAttendanceInput,
  type CreateAttendanceInput,
  type ListResponse,
  type MyAttendanceToday,
  pageMeta,
} from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { CalendarService } from '../calendar/calendar.service';
import { addDays, dateOnly, isWorkingDay, lateAfter, weekday, zonedTime } from '../calendar/work-calendar';
import { Clock } from '../common/clock';
import { conflict, invalidFields } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { NotificationService } from '../notifications/notifications.service';
import { attendanceIssues, shortDate } from '../notifications/wording';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceIngestService } from './attendance-ingest.service';
import { checkInStatus, closingStatus, isClosable, NO_TIME_STATUSES, workedMinutes } from './attendance-rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ITEM_SELECT = {
  id: true,
  workDate: true,
  firstInAt: true,
  lastOutAt: true,
  workedMinutes: true,
  lateMinutes: true,
  status: true,
  note: true,
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
  _count: { select: { records: { where: { source: 'ADMIN' } } } },
} satisfies Prisma.AttendanceSelect;

type ItemRow = Prisma.AttendanceGetPayload<{ select: typeof ITEM_SELECT }>;

function toItem(row: ItemRow): AttendanceItem {
  return {
    id: row.id,
    employee: {
      id: row.employee.id,
      name: `${row.employee.firstName} ${row.employee.lastName}`,
      employeeCode: row.employee.employeeCode,
      departmentName: row.employee.department.name,
    },
    workDate: row.workDate.toISOString().slice(0, 10),
    firstInAt: row.firstInAt?.toISOString() ?? null,
    lastOutAt: row.lastOutAt?.toISOString() ?? null,
    workedMinutes: row.workedMinutes,
    lateMinutes: row.lateMinutes,
    status: row.status,
    note: row.note,
    corrected: row._count.records > 0,
  };
}

/** How far back the closing job looks for days that were never closed (e.g. the server was down). */
export const CLOSE_LOOKBACK_DAYS = 7;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly calendar: CalendarService,
    private readonly ingest: AttendanceIngestService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly notifications: NotificationService,
  ) {}

  // ─── Self-service ───────────────────────────────────────────────────────────────────────────

  private requireEmployee(auth: AuthContext): string {
    if (!auth.user.employeeId) throw new NotFoundException('No employee record is linked to your account');
    return auth.user.employeeId;
  }

  async myToday(auth: AuthContext): Promise<MyAttendanceToday> {
    const employeeId = this.requireEmployee(auth);
    const settings = await this.calendar.settings();
    const now = this.clock.now();
    const today = await this.calendar.today(now);
    const day = dateOnly(today);
    const holidays = await this.calendar.holidaysBetween(today, today);

    const [attendance, onLeave] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { employeeId_workDate: { employeeId, workDate: day } },
        select: { id: true, firstInAt: true, lastOutAt: true, workedMinutes: true, lateMinutes: true, status: true },
      }),
      this.prisma.leaveRequest.count({ where: { employeeId, status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } } }),
    ]);

    const checkedIn = Boolean(attendance?.firstInAt);
    const checkedOut = Boolean(attendance?.lastOutAt);
    const reason = onLeave
      ? "You're on approved leave today"
      : checkedOut
        ? 'You have checked out for today'
        : null;

    return {
      today,
      isWorkingDay: isWorkingDay(today, settings, holidays),
      lateAfter: lateAfter(settings),
      onLeave: onLeave > 0,
      attendance: attendance
        ? {
            id: attendance.id,
            firstInAt: attendance.firstInAt?.toISOString() ?? null,
            lastOutAt: attendance.lastOutAt?.toISOString() ?? null,
            workedMinutes: attendance.workedMinutes,
            lateMinutes: attendance.lateMinutes,
            status: attendance.status,
          }
        : null,
      canCheckIn: !onLeave && !checkedIn,
      canCheckOut: checkedIn && !checkedOut,
      reason,
    };
  }

  async checkIn(auth: AuthContext, ip: string | undefined): Promise<MyAttendanceToday> {
    await this.ingest.recordPunch({
      employeeId: this.requireEmployee(auth),
      occurredAt: this.clock.now(),
      type: 'CHECK_IN',
      source: 'WEB',
      ip: ip ?? null,
      createdById: auth.user.id,
    });
    return this.myToday(auth);
  }

  async checkOut(auth: AuthContext, ip: string | undefined): Promise<MyAttendanceToday> {
    await this.ingest.recordPunch({
      employeeId: this.requireEmployee(auth),
      occurredAt: this.clock.now(),
      type: 'CHECK_OUT',
      source: 'WEB',
      ip: ip ?? null,
      createdById: auth.user.id,
    });
    return this.myToday(auth);
  }

  // ─── Reading ────────────────────────────────────────────────────────────────────────────────

  private listWhere(auth: AuthContext, query: { from?: string; to?: string; employeeId?: string; departmentId?: string; status?: AttendanceStatus }): Prisma.AttendanceWhereInput {
    return {
      employee: { AND: [this.scope.employeeWhere(auth, 'attendance.view'), query.departmentId ? { departmentId: query.departmentId } : {}] },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? { workDate: { ...(query.from ? { gte: dateOnly(query.from) } : {}), ...(query.to ? { lte: dateOnly(query.to) } : {}) } }
        : {}),
    };
  }

  async list(auth: AuthContext, query: AttendanceListQuery): Promise<ListResponse<AttendanceItem>> {
    const where = this.listWhere(auth, query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { employee: { firstName: 'asc' } }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: ITEM_SELECT,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { data: rows.map(toItem), meta: pageMeta(query.page, query.limit, total) };
  }

  async summary(auth: AuthContext, query: { from: string; to: string; employeeId?: string }): Promise<AttendanceSummary> {
    if (query.to < query.from) throw invalidFields({ to: 'The end date must be on or after the start date' });
    const where = this.listWhere(auth, query);
    const [groups, worked, late] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.attendance.aggregate({ where: { AND: [where, { lastOutAt: { not: null } }] }, _avg: { workedMinutes: true } }),
      this.prisma.attendance.aggregate({ where, _sum: { lateMinutes: true } }),
    ]);
    const byStatus = Object.fromEntries(AttendanceStatus.map((status) => [status, 0])) as Record<AttendanceStatus, number>;
    for (const group of groups) byStatus[group.status] = group._count._all;
    const present = byStatus.PRESENT + byStatus.LATE;
    const expected = present + byStatus.ABSENT;
    return {
      from: query.from,
      to: query.to,
      byStatus,
      presentRate: expected > 0 ? Math.round((present / expected) * 1000) / 1000 : null,
      averageWorkedMinutes: worked._avg.workedMinutes === null ? null : Math.round(worked._avg.workedMinutes),
      totalLateMinutes: late._sum.lateMinutes ?? 0,
    };
  }

  // ─── Corrections (attendance.manage) ────────────────────────────────────────────────────────

  async correct(auth: AuthContext, id: string, input: CorrectAttendanceInput): Promise<AttendanceItem> {
    if (!UUID.test(id)) throw new NotFoundException();
    const current = await this.prisma.attendance.findFirst({
      where: { id, employee: this.scope.employeeWhere(auth, 'attendance.manage') },
      select: { id: true, employeeId: true, workDate: true, firstInAt: true, lastOutAt: true, status: true, lateMinutes: true, workedMinutes: true, note: true },
    });
    if (!current) throw new NotFoundException();

    const workDate = current.workDate.toISOString().slice(0, 10);
    const next = await this.resolveCorrection(workDate, input);

    await this.prisma.$transaction(async (tx) => {
      await tx.attendance.update({ where: { id }, data: { ...next, note: input.note } });
      await this.adminRecords(tx, id, current.employeeId, auth.user.id, next, current);
      await this.audit.record(
        {
          action: 'attendance.corrected',
          entityType: 'attendance',
          entityId: id,
          before: { employeeId: current.employeeId, workDate, firstInAt: current.firstInAt, lastOutAt: current.lastOutAt, status: current.status, lateMinutes: current.lateMinutes, workedMinutes: current.workedMinutes, note: current.note },
          after: { employeeId: current.employeeId, workDate, ...next, note: input.note },
        },
        tx,
      );
    });
    return this.getItem(id);
  }

  /** A record for a day that has none yet, such as someone who forgot to check in this morning. */
  async create(auth: AuthContext, input: CreateAttendanceInput): Promise<AttendanceItem> {
    const employee = await this.prisma.employee.findFirst({
      where: { AND: [{ id: input.employeeId }, this.scope.employeeWhere(auth, 'attendance.manage')] },
      select: { id: true, joiningDate: true },
    });
    if (!employee) throw invalidFields({ employeeId: 'Choose an employee you manage attendance for' });

    const today = await this.calendar.today(this.clock.now());
    if (input.workDate > today) throw invalidFields({ workDate: "Attendance can't be recorded for a future day" });
    if (input.workDate < employee.joiningDate.toISOString().slice(0, 10)) throw invalidFields({ workDate: 'That day is before they joined' });

    const next = await this.resolveCorrection(input.workDate, input);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const row = await tx.attendance.create({
          data: { employeeId: input.employeeId, workDate: dateOnly(input.workDate), ...next, note: input.note, sourceSummary: 'ADMIN' },
          select: { id: true },
        });
        await this.adminRecords(tx, row.id, input.employeeId, auth.user.id, next, null);
        await this.audit.record(
          { action: 'attendance.corrected', entityType: 'attendance', entityId: row.id, after: { employeeId: input.employeeId, workDate: input.workDate, ...next, note: input.note } },
          tx,
        );
        return row.id;
      });
      return this.getItem(id);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw conflict('That day already has a record. Correct it instead.');
      throw error;
    }
  }

  /** Turns wall-clock times into the row's values, deriving PRESENT/LATE unless a status is given. */
  private async resolveCorrection(workDate: string, input: { firstIn: string | null; lastOut: string | null; status?: AttendanceStatus }) {
    const settings = await this.calendar.settings();
    const firstInAt = input.firstIn ? zonedTime(workDate, input.firstIn, settings.timeZone) : null;
    const lastOutAt = input.lastOut ? zonedTime(workDate, input.lastOut, settings.timeZone) : null;

    if (input.status && NO_TIME_STATUSES.includes(input.status) && (firstInAt || lastOutAt)) {
      throw invalidFields({ status: `${input.status.replace('_', ' ').toLowerCase()} can't have check-in times; clear them or choose present` });
    }
    if (!firstInAt) {
      return { firstInAt: null, lastOutAt: null, status: input.status ?? ('ABSENT' as const), lateMinutes: 0, workedMinutes: 0 };
    }

    const holidays = await this.calendar.holidaysBetween(workDate, workDate);
    const derived = checkInStatus(firstInAt, workDate, settings, isWorkingDay(workDate, settings, holidays));
    const status = input.status ?? derived.status;
    return {
      firstInAt,
      lastOutAt,
      status,
      lateMinutes: status === 'LATE' ? Math.max(derived.lateMinutes, 0) : 0,
      workedMinutes: workedMinutes(firstInAt, lastOutAt),
    };
  }

  /** Keeps the raw punch history honest: a correction adds ADMIN punches rather than rewriting old ones. */
  private async adminRecords(
    tx: Prisma.TransactionClient,
    attendanceId: string,
    employeeId: string,
    userId: string,
    next: { firstInAt: Date | null; lastOutAt: Date | null },
    current: { firstInAt: Date | null; lastOutAt: Date | null } | null,
  ) {
    const records: Prisma.AttendanceRecordCreateManyInput[] = [];
    if (next.firstInAt && next.firstInAt.getTime() !== current?.firstInAt?.getTime()) {
      records.push({ attendanceId, employeeId, type: 'CHECK_IN', occurredAt: next.firstInAt, source: 'ADMIN', createdById: userId });
    }
    if (next.lastOutAt && next.lastOutAt.getTime() !== current?.lastOutAt?.getTime()) {
      records.push({ attendanceId, employeeId, type: 'CHECK_OUT', occurredAt: next.lastOutAt, source: 'ADMIN', createdById: userId });
    }
    // Clearing times is still a correction worth marking in the history
    if (records.length === 0) {
      const at = next.firstInAt ?? current?.firstInAt ?? new Date();
      records.push({ attendanceId, employeeId, type: 'CHECK_IN', occurredAt: at, source: 'ADMIN', createdById: userId });
    }
    await tx.attendanceRecord.createMany({ data: records });
  }

  private async getItem(id: string): Promise<AttendanceItem> {
    return toItem(await this.prisma.attendance.findUniqueOrThrow({ where: { id }, select: ITEM_SELECT }));
  }

  // ─── Closing days ───────────────────────────────────────────────────────────────────────────

  /**
   * Gives every active employee a row for `date` if they don't have one: HOLIDAY, WEEKEND, ON_LEAVE or
   * ABSENT (plan §7, assumption 3). Safe to run any number of times.
   */
  async closeDay(date: string): Promise<{ date: string; created: number; missingCheckOuts: number }> {
    const settings = await this.calendar.settings();
    const day = dateOnly(date);
    const holiday = (await this.calendar.holidaysBetween(date, date)).has(date);
    const weekend = settings.weekendDays.includes(weekday(date));

    const [employees, onLeave, missingCheckOuts] = await Promise.all([
      this.prisma.employee.findMany({
        where: { deletedAt: null, status: 'ACTIVE', joiningDate: { lte: day }, attendances: { none: { workDate: day } } },
        select: { id: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: { status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } },
        select: { employeeId: true },
      }),
      this.prisma.attendance.count({ where: { workDate: day, firstInAt: { not: null }, lastOutAt: null } }),
    ]);
    const leaving = new Set(onLeave.map((l) => l.employeeId));

    const { count } = await this.prisma.attendance.createMany({
      data: employees.map((e) => ({ employeeId: e.id, workDate: day, status: closingStatus({ holiday, weekend, onLeave: leaving.has(e.id) }) })),
      // Another instance closing the same day at the same moment is harmless
      skipDuplicates: true,
    });
    if (count > 0) {
      this.logger.log({ date, created: count, missingCheckOuts }, 'Closed attendance day');
      // Only when this run closed the day, so re-runs and days closed before notifications existed stay quiet
      if (!holiday && !weekend) await this.notifyIssues(date, missingCheckOuts);
    }
    return { date, created: count, missingCheckOuts };
  }

  /** One summary per closed working day for whoever manages everyone's attendance (plan §9). */
  private async notifyIssues(date: string, missingCheckOuts: number): Promise<void> {
    const absent = await this.prisma.attendance.count({ where: { workDate: dateOnly(date), status: 'ABSENT' } });
    const issues = attendanceIssues(absent, missingCheckOuts);
    if (!issues) return;
    await this.notifications.notify({
      userIds: await this.notifications.usersWithAll('attendance.manage'),
      type: 'attendance.issues',
      title: `${shortDate(date)}: ${issues}`,
      body: absent > 0 ? 'Check whether any of them had leave or forgot to check in, and correct the records.' : 'Add the missing check-out times so worked hours are right.',
      link: `/attendance?from=${date}&to=${date}${absent > 0 ? '&status=ABSENT' : ''}`,
      dedupeKey: `attendance-issues:${date}`,
    });
  }

  /** Closes every closable day in the last week. The scheduler calls this; it catches up after downtime. */
  async closePendingDays(): Promise<Array<{ date: string; created: number; missingCheckOuts: number }>> {
    const settings = await this.calendar.settings();
    const now = this.clock.now();
    const today = await this.calendar.today(now);
    const results = [];
    for (let offset = CLOSE_LOOKBACK_DAYS; offset >= 0; offset--) {
      const date = addDays(today, -offset);
      if (isClosable(date, now, settings.timeZone)) results.push(await this.closeDay(date));
    }
    return results;
  }

  async closeDayManually(date: string): Promise<{ date: string; created: number; missingCheckOuts: number }> {
    const settings = await this.calendar.settings();
    if (!isClosable(date, this.clock.now(), settings.timeZone)) {
      throw invalidFields({ date: 'A day can only be closed from 23:55 that evening' });
    }
    const result = await this.closeDay(date);
    await this.audit.record({ action: 'attendance.day_closed', entityType: 'attendance', entityId: null, after: { workDate: date, created: result.created } });
    return result;
  }
}
