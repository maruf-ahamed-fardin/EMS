import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateLeaveRequestInput,
  type LeavePreview,
  type LeavePreviewInput,
  type LeaveRequestItem,
  type LeaveRequestListQuery,
  type ListResponse,
  pageMeta,
} from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { CalendarService } from '../calendar/calendar.service';
import { dateOnly } from '../calendar/work-calendar';
import { Clock } from '../common/clock';
import { conflict, invalidFields } from '../common/errors/http-errors';
import { DashboardCache } from '../dashboard/dashboard-cache';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveBalancesService } from './leave-balances.service';
import { available, countLeaveDays } from './leave-rules';

type Tx = Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUEST_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  days: true,
  reason: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  reviewNote: true,
  employeeId: true,
  leaveTypeId: true,
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, managerId: true, department: { select: { name: true } } } },
  leaveType: { select: { id: true, name: true, isPaid: true } },
  reviewedBy: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.LeaveRequestSelect;

type RequestRow = Prisma.LeaveRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

const iso = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly calendar: CalendarService,
    private readonly balances: LeaveBalancesService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly dashboardCache: DashboardCache,
  ) {}

  private requireEmployee(auth: AuthContext): string {
    if (!auth.user.employeeId) throw new NotFoundException('No employee record is linked to your account');
    return auth.user.employeeId;
  }

  // ─── Preview and request ────────────────────────────────────────────────────────────────────

  /** What a request would cost and what would stop it, without saving anything (plan §6). */
  async preview(auth: AuthContext, input: LeavePreviewInput, db: Tx | PrismaService = this.prisma): Promise<LeavePreview> {
    const employeeId = this.requireEmployee(auth);
    const type = await db.leaveType.findFirst({ where: { id: input.leaveTypeId, deletedAt: null, isActive: true }, select: { id: true, name: true, isPaid: true } });
    if (!type) throw invalidFields({ leaveTypeId: 'Choose an active leave type' });

    const settings = await this.calendar.settings();
    const holidays = await this.calendar.holidayNamesBetween(input.startDate, input.endDate);
    const { workingDays, excludedDays } = countLeaveDays(input.startDate, input.endDate, settings, holidays);
    const days = workingDays.length;
    const year = Number(input.startDate.slice(0, 4));

    // One after another: inside create() these share a single transaction connection
    const overlaps = await db.leaveRequest.findMany({
      where: { employeeId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: dateOnly(input.endDate) }, endDate: { gte: dateOnly(input.startDate) } },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true, status: true, leaveType: { select: { name: true } } },
    });
    const balance = type.isPaid ? await db.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: type.id, year } } }) : null;
    const employee = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { joiningDate: true, status: true } });

    const availableDays = type.isPaid
      ? balance
        ? available({ allocated: Number(balance.allocated), carriedForward: Number(balance.carriedForward), used: Number(balance.used), pending: Number(balance.pending) })
        : 0
      : null;

    const today = await this.calendar.today(this.clock.now());
    const problems: string[] = [];
    if (employee.status !== 'ACTIVE') problems.push('Only active employees can request leave');
    if (input.startDate < today) problems.push("Leave can't start in the past. Ask HR to record past leave.");
    if (input.startDate < iso(employee.joiningDate)) problems.push('Leave can’t start before your joining date');
    if (days === 0) problems.push('Those dates are all weekends or holidays, so there is nothing to request');
    if (overlaps.length > 0) problems.push('You already have leave requested or approved on some of these days');
    if (availableDays !== null && days > availableDays) {
      problems.push(`You have ${availableDays} ${availableDays === 1 ? 'day' : 'days'} of ${type.name} leave left for ${year}; this needs ${days}`);
    }

    return {
      days,
      workingDays,
      excludedDays,
      isPaid: type.isPaid,
      available: availableDays,
      availableAfter: availableDays === null ? null : availableDays - days,
      overlaps: overlaps.map((o) => ({ id: o.id, startDate: iso(o.startDate), endDate: iso(o.endDate), status: o.status, leaveType: o.leaveType.name })),
      problems,
    };
  }

  async create(auth: AuthContext, input: CreateLeaveRequestInput): Promise<LeaveRequestItem> {
    const employeeId = this.requireEmployee(auth);
    // The balance may not exist yet (next year's leave, a type added today)
    await this.balances.ensureYear(Number(input.startDate.slice(0, 4)), { employeeIds: [employeeId] });

    const id = await this.prisma.$transaction(async (tx) => {
      // One request at a time per person: the checks below and the balance change happen together,
      // so two submissions at once can't both pass the same balance or overlap check (plan §7)
      await this.lockEmployee(tx, employeeId);
      const preview = await this.preview(auth, input, tx);
      if (preview.problems.length > 0) throw conflict(preview.problems[0]!, { startDate: preview.problems[0]! });

      const year = Number(input.startDate.slice(0, 4));
      if (preview.isPaid) {
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: input.leaveTypeId, year } },
          data: { pending: { increment: preview.days } },
        });
      }
      const request = await tx.leaveRequest.create({
        data: { employeeId, leaveTypeId: input.leaveTypeId, startDate: dateOnly(input.startDate), endDate: dateOnly(input.endDate), days: preview.days, reason: input.reason },
        select: { id: true },
      });
      await this.audit.record(
        { action: 'leave.requested', entityType: 'leave_request', entityId: request.id, after: { employeeId, leaveTypeId: input.leaveTypeId, startDate: input.startDate, endDate: input.endDate, days: preview.days } },
        tx,
      );
      return request.id;
    });
    return this.get(auth, id);
  }

  private async lockEmployee(tx: Tx, employeeId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${employeeId}`}))`;
  }

  // ─── Reading ────────────────────────────────────────────────────────────────────────────────

  private reviewableWhere(auth: AuthContext): Prisma.LeaveRequestWhereInput {
    return {
      status: 'PENDING',
      employee: this.scope.employeeWhere(auth, 'leave.approve'),
      ...(auth.user.employeeId ? { employeeId: { not: auth.user.employeeId } } : {}),
    };
  }

  async list(auth: AuthContext, query: LeaveRequestListQuery): Promise<ListResponse<LeaveRequestItem>> {
    const visible: Prisma.LeaveRequestWhereInput = query.mine
      ? { employeeId: auth.user.employeeId ?? '00000000-0000-0000-0000-000000000000' }
      : query.reviewable
        ? this.reviewableWhere(auth)
        : { OR: [{ employee: this.scope.employeeWhere(auth, 'leave.view') }, ...(auth.user.employeeId ? [{ employeeId: auth.user.employeeId }] : [])] };

    const where: Prisma.LeaveRequestWhereInput = {
      AND: [
        visible,
        query.status ? { status: query.status } : {},
        query.employeeId ? { employeeId: query.employeeId } : {},
        query.year ? { startDate: { gte: dateOnly(`${query.year}-01-01`), lte: dateOnly(`${query.year}-12-31`) } } : {},
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        // The review queue shows the longest waiting first; other lists the most recent first
        orderBy: query.reviewable ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ startDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: REQUEST_SELECT,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data: await this.toItems(auth, rows), meta: pageMeta(query.page, query.limit, total) };
  }

  async get(auth: AuthContext, id: string): Promise<LeaveRequestItem> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.leaveRequest.findFirst({
      where: { id, OR: [{ employee: this.scope.employeeWhere(auth, 'leave.view') }, ...(auth.user.employeeId ? [{ employeeId: auth.user.employeeId }] : [])] },
      select: REQUEST_SELECT,
    });
    if (!row) throw new NotFoundException();
    return (await this.toItems(auth, [row]))[0]!;
  }

  private async toItems(auth: AuthContext, rows: RequestRow[]): Promise<LeaveRequestItem[]> {
    const today = await this.calendar.today(this.clock.now());
    const balances = await this.prisma.leaveBalance.findMany({
      where: { OR: rows.filter((r) => r.leaveType.isPaid).map((r) => ({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, year: r.startDate.getUTCFullYear() })) },
    });
    const balanceOf = (r: RequestRow) => balances.find((b) => b.employeeId === r.employeeId && b.leaveTypeId === r.leaveTypeId && b.year === r.startDate.getUTCFullYear());

    return rows.map((row) => {
      const target = { id: row.employee.id, managerId: row.employee.managerId };
      const own = auth.user.employeeId === row.employeeId;
      const pending = row.status === 'PENDING';
      const notStarted = iso(row.startDate) > today;
      const balance = balanceOf(row);
      return {
        id: row.id,
        employee: { id: row.employee.id, name: `${row.employee.firstName} ${row.employee.lastName}`, employeeCode: row.employee.employeeCode, departmentName: row.employee.department.name },
        leaveType: row.leaveType,
        startDate: iso(row.startDate),
        endDate: iso(row.endDate),
        days: Number(row.days),
        reason: row.reason,
        status: row.status,
        requestedAt: row.createdAt.toISOString(),
        reviewedBy: row.reviewedBy ? (row.reviewedBy.employee ? `${row.reviewedBy.employee.firstName} ${row.reviewedBy.employee.lastName}` : row.reviewedBy.email) : null,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        allowedActions: {
          approve: pending && !own && this.scope.reaches(auth, 'leave.approve', target),
          reject: pending && !own && this.scope.reaches(auth, 'leave.reject', target),
          cancel: (pending || (row.status === 'APPROVED' && notStarted)) && (own || auth.permissions['leave.approve'] === 'ALL'),
        },
        balanceAvailable: balance
          ? available({ allocated: Number(balance.allocated), carriedForward: Number(balance.carriedForward), used: Number(balance.used), pending: Number(balance.pending) })
          : null,
      };
    });
  }

  // ─── Decisions ──────────────────────────────────────────────────────────────────────────────

  /** Loads a request for a decision, enforcing scope and the "never your own" rule. */
  private async loadForDecision(auth: AuthContext, id: string, key: 'leave.approve' | 'leave.reject') {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.leaveRequest.findFirst({
      where: { id, OR: [{ employee: this.scope.employeeWhere(auth, 'leave.view') }, ...(auth.user.employeeId ? [{ employeeId: auth.user.employeeId }] : [])] },
      select: { id: true, employeeId: true, leaveTypeId: true, startDate: true, endDate: true, days: true, status: true, employee: { select: { managerId: true } }, leaveType: { select: { isPaid: true } } },
    });
    if (!row) throw new NotFoundException();
    // Nobody decides their own leave, whatever their role (plan §4)
    if (row.employeeId === auth.user.employeeId) throw new ForbiddenException("You can't decide your own leave request");
    if (!this.scope.reaches(auth, key, { id: row.employeeId, managerId: row.employee.managerId })) throw new ForbiddenException();
    return row;
  }

  async approve(auth: AuthContext, id: string, note?: string): Promise<LeaveRequestItem> {
    const row = await this.loadForDecision(auth, id, 'leave.approve');
    await this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, row.employeeId);
      // Only a still-pending request changes; a second approval finds nothing and stops
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedById: auth.user.id, reviewedAt: new Date(), reviewNote: note || null },
      });
      if (claimed.count !== 1) throw conflict('This request has already been decided');

      if (row.leaveType.isPaid) {
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: row.employeeId, leaveTypeId: row.leaveTypeId, year: row.startDate.getUTCFullYear() } },
          data: { pending: { decrement: row.days }, used: { increment: row.days } },
        });
      }
      // Days already recorded without a check-in become leave (plan §7)
      await tx.attendance.updateMany({
        where: { employeeId: row.employeeId, workDate: { gte: row.startDate, lte: row.endDate }, firstInAt: null, status: { notIn: ['HOLIDAY', 'WEEKEND'] } },
        data: { status: 'ON_LEAVE' },
      });
      await this.audit.record({ action: 'leave.approved', entityType: 'leave_request', entityId: id, before: { status: 'PENDING' }, after: { status: 'APPROVED', note } }, tx);
    });
    this.dashboardCache.invalidate();
    return this.get(auth, id);
  }

  async reject(auth: AuthContext, id: string, note: string): Promise<LeaveRequestItem> {
    const row = await this.loadForDecision(auth, id, 'leave.reject');
    await this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, row.employeeId);
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', reviewedById: auth.user.id, reviewedAt: new Date(), reviewNote: note },
      });
      if (claimed.count !== 1) throw conflict('This request has already been decided');
      if (row.leaveType.isPaid) {
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: row.employeeId, leaveTypeId: row.leaveTypeId, year: row.startDate.getUTCFullYear() } },
          data: { pending: { decrement: row.days } },
        });
      }
      await this.audit.record({ action: 'leave.rejected', entityType: 'leave_request', entityId: id, before: { status: 'PENDING' }, after: { status: 'REJECTED', note } }, tx);
    });
    return this.get(auth, id);
  }

  /**
   * The requester cancels their own request; HR (leave.approve at ALL) can cancel anyone's. Approved
   * leave that has already started can't be cancelled: HR corrects attendance and balances instead.
   */
  async cancel(auth: AuthContext, id: string): Promise<LeaveRequestItem> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.leaveRequest.findFirst({
      where: { id, OR: [{ employee: this.scope.employeeWhere(auth, 'leave.view') }, ...(auth.user.employeeId ? [{ employeeId: auth.user.employeeId }] : [])] },
      select: { id: true, employeeId: true, leaveTypeId: true, startDate: true, endDate: true, days: true, status: true, leaveType: { select: { isPaid: true } } },
    });
    if (!row) throw new NotFoundException();
    if (row.employeeId !== auth.user.employeeId && auth.permissions['leave.approve'] !== 'ALL') throw new ForbiddenException();

    const today = await this.calendar.today(this.clock.now());
    if (row.status === 'APPROVED' && iso(row.startDate) <= today) {
      throw conflict('This leave has already started, so it can’t be cancelled. Ask HR to adjust it.');
    }
    if (row.status !== 'PENDING' && row.status !== 'APPROVED') throw conflict('Only pending or upcoming approved leave can be cancelled');

    await this.prisma.$transaction(async (tx) => {
      await this.lockEmployee(tx, row.employeeId);
      const claimed = await tx.leaveRequest.updateMany({ where: { id, status: row.status }, data: { status: 'CANCELLED', reviewedAt: new Date() } });
      if (claimed.count !== 1) throw conflict('This request has changed. Reload and try again.');
      if (row.leaveType.isPaid) {
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: row.employeeId, leaveTypeId: row.leaveTypeId, year: row.startDate.getUTCFullYear() } },
          data: row.status === 'PENDING' ? { pending: { decrement: row.days } } : { used: { decrement: row.days } },
        });
      }
      await this.audit.record({ action: 'leave.cancelled', entityType: 'leave_request', entityId: id, before: { status: row.status }, after: { status: 'CANCELLED' } }, tx);
    });
    this.dashboardCache.invalidate();
    return this.get(auth, id);
  }
}
