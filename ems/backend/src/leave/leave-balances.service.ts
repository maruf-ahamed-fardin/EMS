import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AdjustLeaveBalanceInput, LeaveBalanceRow } from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { CalendarService } from '../calendar/calendar.service';
import { dateOnly } from '../calendar/work-calendar';
import { Clock } from '../common/clock';
import { invalidFields } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { available, carryForward, proratedAllocation } from './leave-rules';

type Db = PrismaService | Prisma.TransactionClient;

const BALANCE_SELECT = {
  id: true,
  year: true,
  allocated: true,
  carriedForward: true,
  used: true,
  pending: true,
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
} satisfies Prisma.LeaveBalanceSelect;

type BalanceRow = Prisma.LeaveBalanceGetPayload<{ select: typeof BALANCE_SELECT }>;

export function toBalanceRow(row: BalanceRow): LeaveBalanceRow {
  const numbers = { allocated: Number(row.allocated), carriedForward: Number(row.carriedForward), used: Number(row.used), pending: Number(row.pending) };
  return {
    id: row.id,
    employee: { id: row.employee.id, name: `${row.employee.firstName} ${row.employee.lastName}`, employeeCode: row.employee.employeeCode },
    leaveType: row.leaveType,
    year: row.year,
    ...numbers,
    available: available(numbers),
  };
}

@Injectable()
export class LeaveBalancesService {
  private readonly logger = new Logger(LeaveBalancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly calendar: CalendarService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async currentYear(): Promise<number> {
    return Number((await this.calendar.today(this.clock.now())).slice(0, 4));
  }

  /**
   * Makes sure every active employee has a balance for every active paid leave type in `year`:
   * prorated for people who join during the year, with capped carry-forward from the year before
   * (plan §7). Existing balances are never touched, so it is safe to run at any time.
   */
  async ensureYear(year: number, options: { employeeIds?: string[]; db?: Db } = {}): Promise<number> {
    const db = options.db ?? this.prisma;
    const [employees, types] = await Promise.all([
      db.employee.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          joiningDate: { lte: dateOnly(`${year}-12-31`) },
          ...(options.employeeIds ? { id: { in: options.employeeIds } } : {}),
        },
        select: { id: true, joiningDate: true },
      }),
      db.leaveType.findMany({ where: { deletedAt: null, isActive: true, isPaid: true }, select: { id: true, defaultDaysPerYear: true, carryForwardMax: true } }),
    ]);
    if (employees.length === 0 || types.length === 0) return 0;

    const existing = await db.leaveBalance.findMany({
      where: { year: { in: [year, year - 1] }, employeeId: { in: employees.map((e) => e.id) } },
      select: { employeeId: true, leaveTypeId: true, year: true, allocated: true, carriedForward: true, used: true, pending: true },
    });
    const key = (employeeId: string, typeId: string, y: number) => `${employeeId}:${typeId}:${y}`;
    const byKey = new Map(existing.map((b) => [key(b.employeeId, b.leaveTypeId, b.year), b]));

    const data: Prisma.LeaveBalanceCreateManyInput[] = [];
    for (const employee of employees) {
      for (const type of types) {
        if (byKey.has(key(employee.id, type.id, year))) continue;
        const previous = byKey.get(key(employee.id, type.id, year - 1));
        data.push({
          employeeId: employee.id,
          leaveTypeId: type.id,
          year,
          allocated: proratedAllocation(Number(type.defaultDaysPerYear), employee.joiningDate.toISOString().slice(0, 10), year),
          carriedForward: carryForward(
            previous
              ? { allocated: Number(previous.allocated), carriedForward: Number(previous.carriedForward), used: Number(previous.used), pending: Number(previous.pending) }
              : null,
            Number(type.carryForwardMax),
          ),
        });
      }
    }
    if (data.length === 0) return 0;
    const { count } = await db.leaveBalance.createMany({ data, skipDuplicates: true });
    if (count > 0) this.logger.log({ year, created: count }, 'Created leave balances');
    return count;
  }

  async list(auth: AuthContext, query: { employeeId?: string; year?: number }): Promise<LeaveBalanceRow[]> {
    const year = query.year ?? (await this.currentYear());
    const employeeId = query.employeeId ?? auth.user.employeeId;
    if (!employeeId) return [];
    const rows = await this.prisma.leaveBalance.findMany({
      where: {
        year,
        employeeId,
        leaveType: { deletedAt: null },
        // Your own balances are always yours to see; anyone else's needs leave.view in scope
        ...(employeeId === auth.user.employeeId ? {} : { employee: this.scope.employeeWhere(auth, 'leave.view') }),
      },
      orderBy: { leaveType: { name: 'asc' } },
      select: BALANCE_SELECT,
    });
    return rows.map(toBalanceRow);
  }

  async adjust(auth: AuthContext, id: string, input: AdjustLeaveBalanceInput): Promise<LeaveBalanceRow> {
    const current = await this.prisma.leaveBalance
      .findFirst({ where: { id, employee: this.scope.employeeWhere(auth, 'leave.manage_balances') }, select: BALANCE_SELECT })
      .catch(() => null);
    if (!current) throw new NotFoundException();

    const allocated = Number(input.allocated ?? current.allocated);
    const carriedForward = Number(input.carriedForward ?? current.carriedForward);
    const committed = Number(current.used) + Number(current.pending);
    if (allocated + carriedForward < committed) {
      throw invalidFields({ allocated: `At least ${committed} days are already used or pending, so the balance can't go below that` });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveBalance.update({ where: { id }, data: { allocated, carriedForward } });
      await this.audit.record(
        {
          action: 'leave_balance.adjusted',
          entityType: 'leave_balance',
          entityId: id,
          before: { employeeId: current.employee.id, leaveTypeId: current.leaveType.id, year: current.year, allocated: Number(current.allocated), carriedForward: Number(current.carriedForward) },
          after: { employeeId: current.employee.id, leaveTypeId: current.leaveType.id, year: current.year, allocated, carriedForward, note: input.note },
        },
        tx,
      );
    });
    return toBalanceRow(await this.prisma.leaveBalance.findUniqueOrThrow({ where: { id }, select: BALANCE_SELECT }));
  }
}
