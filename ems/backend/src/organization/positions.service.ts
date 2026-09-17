import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreatePositionInput, PositionListItem, PositionListQuery, UpdatePositionInput } from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import { conflict, invalidFields } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUuid, pluralize } from './organization-helpers';

const ACTIVE_EMPLOYEE = { deletedAt: null, status: 'ACTIVE' } as const;

const POSITION_SELECT = {
  id: true,
  title: true,
  level: true,
  isActive: true,
  department: { select: { id: true, name: true } },
  _count: { select: { employees: { where: ACTIVE_EMPLOYEE } } },
} satisfies Prisma.PositionSelect;

type Row = Prisma.PositionGetPayload<{ select: typeof POSITION_SELECT }>;

function toItem(row: Row): PositionListItem {
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    isActive: row.isActive,
    department: row.department,
    activeEmployeeCount: row._count.employees,
  };
}

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PositionListQuery): Promise<PositionListItem[]> {
    const rows = await this.prisma.position.findMany({
      where: {
        deletedAt: null,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ department: { name: 'asc' } }, { title: 'asc' }],
      select: POSITION_SELECT,
    });
    return rows.map(toItem);
  }

  async get(id: string): Promise<PositionListItem> {
    const row = isUuid(id) ? await this.prisma.position.findFirst({ where: { id, deletedAt: null }, select: POSITION_SELECT }) : null;
    if (!row) throw new NotFoundException();
    return toItem(row);
  }

  async create(input: CreatePositionInput): Promise<PositionListItem> {
    const data = input as Required<Pick<CreatePositionInput, 'title' | 'departmentId'>> & CreatePositionInput;
    await this.assertDepartment(data.departmentId);
    await this.assertUnique(data.title, data.departmentId);

    const created = await this.prisma.$transaction(async (tx) => {
      const position = await tx.position.create({
        data: { title: data.title, departmentId: data.departmentId, level: data.level ?? null, isActive: data.isActive ?? true },
        select: { id: true },
      });
      await this.audit.record({ action: 'position.created', entityType: 'position', entityId: position.id, after: { ...data } }, tx);
      return position;
    }).catch(async (error: unknown) => {
      if ((error as { code?: string }).code === 'P2002') await this.assertUnique(data.title, data.departmentId);
      throw error;
    });
    return this.get(created.id);
  }

  async update(id: string, input: UpdatePositionInput): Promise<PositionListItem> {
    const current = await this.load(id);
    const changes = Object.fromEntries(
      Object.entries(input).filter(([key, value]) => value !== undefined && current[key as keyof typeof current] !== value),
    ) as UpdatePositionInput;
    if (Object.keys(changes).length === 0) return this.get(id);

    const holders = await this.prisma.employee.count({ where: { positionId: id, ...ACTIVE_EMPLOYEE } });
    if ('departmentId' in changes) {
      await this.assertDepartment(changes.departmentId ?? null);
      // Employees' department and position must agree; moving the position would break that for them
      if (holders > 0 && changes.departmentId !== null) {
        throw conflict(`${pluralize(holders, 'active employee')} hold this position. Move them before changing its department.`);
      }
    }
    if (changes.isActive === false && holders > 0) {
      throw conflict(`${pluralize(holders, 'active employee')} hold this position. Change their position before deactivating it.`);
    }
    if (changes.title !== undefined || 'departmentId' in changes) {
      await this.assertUnique(changes.title ?? current.title, 'departmentId' in changes ? (changes.departmentId ?? null) : current.departmentId, id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.position.update({ where: { id }, data: changes });
      await this.audit.record(
        {
          action: 'position.updated',
          entityType: 'position',
          entityId: id,
          before: Object.fromEntries(Object.keys(changes).map((key) => [key, current[key as keyof typeof current]])),
          after: { ...changes },
        },
        tx,
      );
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    const holders = await this.prisma.employee.count({ where: { positionId: id, ...ACTIVE_EMPLOYEE } });
    if (holders > 0) {
      throw conflict(`${pluralize(holders, 'active employee')} hold ${current.title}. Change their position first.`);
    }
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.position.update({ where: { id }, data: { deletedAt: now } });
      await this.audit.record({ action: 'position.deleted', entityType: 'position', entityId: id, before: { title: current.title }, after: { deletedAt: now } }, tx);
    });
  }

  private async load(id: string) {
    const row = isUuid(id)
      ? await this.prisma.position.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, departmentId: true, level: true, isActive: true } })
      : null;
    if (!row) throw new NotFoundException();
    return row;
  }

  private async assertDepartment(departmentId: string | null): Promise<void> {
    if (!departmentId) return;
    const exists = await this.prisma.department.count({ where: { id: departmentId, deletedAt: null } });
    if (!exists) throw invalidFields({ departmentId: 'Choose an existing department' });
  }

  /**
   * One title per department. Postgres treats NULL departments as distinct, so shared positions
   * (no department) are checked here rather than by the index alone.
   */
  private async assertUnique(title: string, departmentId: string | null, excludeId?: string): Promise<void> {
    const taken = await this.prisma.position.count({
      where: { title: { equals: title, mode: 'insensitive' }, departmentId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (taken) {
      throw conflict('This position already exists', {
        title: departmentId ? 'This department already has a position with this title' : 'A shared position with this title already exists',
      });
    }
  }
}
