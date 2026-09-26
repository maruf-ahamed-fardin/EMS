import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateLeaveTypeInput, LeaveTypeItem, UpdateLeaveTypeInput } from '@/lib/validations';
import { AuditService } from '@/lib/services/audit/audit.service';
import { conflict } from '@/lib/http/errors/http-errors';
import type { Prisma } from '@/lib/db/generated/prisma/client';
import { PrismaService } from '@/lib/db/prisma';
import { LeaveBalancesService } from './leave-balances.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_SELECT = {
  id: true,
  name: true,
  code: true,
  defaultDaysPerYear: true,
  carryForwardMax: true,
  isPaid: true,
  requiresDocument: true,
  isActive: true,
  _count: { select: { requests: { where: { status: 'PENDING' } } } },
} satisfies Prisma.LeaveTypeSelect;

function toItem(row: Prisma.LeaveTypeGetPayload<{ select: typeof TYPE_SELECT }>): LeaveTypeItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    defaultDaysPerYear: Number(row.defaultDaysPerYear),
    carryForwardMax: Number(row.carryForwardMax),
    isPaid: row.isPaid,
    requiresDocument: row.requiresDocument,
    isActive: row.isActive,
    pendingRequests: row._count.requests,
  };
}

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly balances: LeaveBalancesService,
  ) {}

  async list(includeInactive: boolean): Promise<LeaveTypeItem[]> {
    const rows = await this.prisma.leaveType.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
      select: TYPE_SELECT,
    });
    return rows.map(toItem);
  }

  /** A new paid type gives everyone this year's balance straight away. */
  async create(input: CreateLeaveTypeInput): Promise<LeaveTypeItem> {
    const data = input as Required<CreateLeaveTypeInput>;
    await this.assertUnique(data.name, data.code);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.leaveType.create({ data, select: { id: true } });
      await this.audit.record({ action: 'leave_type.created', entityType: 'leave_type', entityId: created.id, after: { ...data } }, tx);
      return created;
    });
    await this.balances.ensureYear(await this.balances.currentYear());
    return this.get(row.id);
  }

  /**
   * Changing the yearly allowance applies to balances created from now on (next year, new joiners).
   * Existing balances are adjusted one by one, so nobody's days change without a record.
   */
  async update(id: string, input: UpdateLeaveTypeInput): Promise<LeaveTypeItem> {
    const current = await this.load(id);
    if (input.name !== undefined || input.code !== undefined) await this.assertUnique(input.name, input.code, id);
    if (input.isActive === false && current._count.requests > 0) {
      throw conflict(`${current._count.requests} pending ${current._count.requests === 1 ? 'request uses' : 'requests use'} ${current.name}. Decide them before deactivating it.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.leaveType.update({ where: { id }, data: input });
      await this.audit.record(
        {
          action: 'leave_type.updated',
          entityType: 'leave_type',
          entityId: id,
          before: Object.fromEntries(Object.keys(input).map((k) => [k, toItem(current)[k as keyof LeaveTypeItem]])),
          after: { ...input },
        },
        tx,
      );
    });
    if (input.isActive === true || input.isPaid === true) await this.balances.ensureYear(await this.balances.currentYear());
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    if (current._count.requests > 0) {
      throw conflict(`${current._count.requests} pending ${current._count.requests === 1 ? 'request uses' : 'requests use'} ${current.name}. Decide them before deleting it.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.leaveType.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.record({ action: 'leave_type.deleted', entityType: 'leave_type', entityId: id, before: { name: current.name, code: current.code } }, tx);
    });
  }

  private async get(id: string): Promise<LeaveTypeItem> {
    return toItem(await this.prisma.leaveType.findUniqueOrThrow({ where: { id }, select: TYPE_SELECT }));
  }

  private async load(id: string) {
    const row = UUID.test(id) ? await this.prisma.leaveType.findFirst({ where: { id, deletedAt: null }, select: TYPE_SELECT }) : null;
    if (!row) throw new NotFoundException();
    return row;
  }

  private async assertUnique(name?: string, code?: string, excludeId?: string): Promise<void> {
    const notSelf = excludeId ? { id: { not: excludeId } } : {};
    const errors: Record<string, string> = {};
    if (name && (await this.prisma.leaveType.count({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null, ...notSelf } }))) {
      errors.name = 'Another leave type already has this name';
    }
    if (code && (await this.prisma.leaveType.count({ where: { code, deletedAt: null, ...notSelf } }))) {
      errors.code = 'Another leave type already uses this code';
    }
    if (Object.keys(errors).length > 0) throw conflict('Some details are already used by another leave type', errors);
  }
}
