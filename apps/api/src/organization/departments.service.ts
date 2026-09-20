import { Injectable, NotFoundException } from '@nestjs/common';
import {
  can,
  type CreateDepartmentInput,
  type DepartmentDetail,
  type DepartmentHeadOption,
  type DepartmentListItem,
  type DepartmentListQuery,
  type UpdateDepartmentInput,
} from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { conflict, invalidFields } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUuid, pluralize } from './organization-helpers';

const ACTIVE_EMPLOYEE = { deletedAt: null, status: 'ACTIVE' } as const;

const DEPARTMENT_LIST_SELECT = {
  id: true,
  name: true,
  code: true,
  description: true,
  isActive: true,
  head: { select: { id: true, firstName: true, lastName: true, position: { select: { title: true } } } },
  _count: {
    select: {
      employees: { where: ACTIVE_EMPLOYEE },
      positions: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.DepartmentSelect;

type ListRow = Prisma.DepartmentGetPayload<{ select: typeof DEPARTMENT_LIST_SELECT }>;

function toListItem(row: ListRow): DepartmentListItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    isActive: row.isActive,
    head: row.head ? { id: row.head.id, name: `${row.head.firstName} ${row.head.lastName}`, positionTitle: row.head.position.title } : null,
    activeEmployeeCount: row._count.employees,
    positionCount: row._count.positions,
  };
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: DepartmentListQuery): Promise<DepartmentListItem[]> {
    const rows = await this.prisma.department.findMany({
      where: {
        deletedAt: null,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.q
          ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: DEPARTMENT_LIST_SELECT,
    });
    return rows.map(toListItem);
  }

  async get(auth: AuthContext, id: string): Promise<DepartmentDetail> {
    const row = isUuid(id)
      ? await this.prisma.department.findFirst({
          where: { id, deletedAt: null },
          select: {
            ...DEPARTMENT_LIST_SELECT,
            createdAt: true,
            updatedAt: true,
            positions: {
              where: { deletedAt: null },
              orderBy: { title: 'asc' },
              select: { id: true, title: true, level: true, isActive: true, _count: { select: { employees: { where: ACTIVE_EMPLOYEE } } } },
            },
          },
        })
      : null;
    if (!row) throw new NotFoundException();

    const inactiveEmployeeCount = await this.prisma.employee.count({ where: { departmentId: id, deletedAt: null, status: 'INACTIVE' } });
    const item = toListItem(row);
    return {
      ...item,
      inactiveEmployeeCount,
      positions: row.positions.map((p) => ({ id: p.id, title: p.title, level: p.level, isActive: p.isActive, activeEmployeeCount: p._count.employees })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      allowedActions: {
        update: can(auth.permissions, 'department.update'),
        delete: can(auth.permissions, 'department.delete') && item.activeEmployeeCount === 0,
        managePositions: can(auth.permissions, 'position.manage'),
      },
    };
  }

  /** Active employees who can be made head of a department. Needs department.create or update. */
  async headOptions(): Promise<DepartmentHeadOption[]> {
    const rows = await this.prisma.employee.findMany({
      where: ACTIVE_EMPLOYEE,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true, position: { select: { title: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      employeeCode: r.employeeCode,
      positionTitle: r.position.title,
      departmentId: r.departmentId,
    }));
  }

  async create(auth: AuthContext, input: CreateDepartmentInput): Promise<DepartmentDetail> {
    const data = input as Required<Pick<CreateDepartmentInput, 'name' | 'code'>> & CreateDepartmentInput;
    await this.assertUnique({ name: data.name, code: data.code });
    if (data.headEmployeeId) await this.assertHead(data.headEmployeeId);

    const created = await this.uniqueGuard({ name: data.name, code: data.code }, () =>
      this.prisma.$transaction(async (tx) => {
        const department = await tx.department.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            headEmployeeId: data.headEmployeeId ?? null,
            isActive: data.isActive ?? true,
          },
          select: { id: true },
        });
        await this.audit.record({ action: 'department.created', entityType: 'department', entityId: department.id, after: { ...data } }, tx);
        return department;
      }),
    );
    return this.get(auth, created.id);
  }

  async update(auth: AuthContext, id: string, input: UpdateDepartmentInput): Promise<DepartmentDetail> {
    const current = await this.load(id);
    const changes = Object.fromEntries(
      Object.entries(input).filter(([key, value]) => value !== undefined && current[key as keyof typeof current] !== value),
    ) as UpdateDepartmentInput;
    if (Object.keys(changes).length === 0) {
      this.audit.skip('Nothing changed');
      return this.get(auth, id);
    }

    await this.assertUnique({ name: changes.name, code: changes.code }, id);
    if (changes.headEmployeeId) await this.assertHead(changes.headEmployeeId);
    if (changes.isActive === false) {
      // New hires can't join an inactive department, but people already in it stay; say so plainly
      const active = await this.prisma.employee.count({ where: { departmentId: id, ...ACTIVE_EMPLOYEE } });
      if (active > 0) {
        throw conflict(`${current.name} still has ${pluralize(active, 'active employee')}. Move them before deactivating the department.`);
      }
    }

    await this.uniqueGuard({ name: changes.name, code: changes.code }, () =>
      this.prisma.$transaction(async (tx) => {
        await tx.department.update({ where: { id }, data: changes });
        await this.audit.record(
          {
            action: 'department.updated',
            entityType: 'department',
            entityId: id,
            before: Object.fromEntries(Object.keys(changes).map((key) => [key, current[key as keyof typeof current]])),
            after: { ...changes },
          },
          tx,
        );
      }),
    );
    return this.get(auth, id);
  }

  /** Soft delete. Refused while anyone active still works there (plan Phase 4). */
  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    const active = await this.prisma.employee.count({ where: { departmentId: id, ...ACTIVE_EMPLOYEE } });
    if (active > 0) {
      throw conflict(`${current.name} still has ${pluralize(active, 'active employee')}. Move them to another department first.`);
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.department.update({ where: { id }, data: { deletedAt: now, headEmployeeId: null } });
      const positions = await tx.position.updateMany({ where: { departmentId: id, deletedAt: null }, data: { deletedAt: now } });
      await this.audit.record(
        { action: 'department.deleted', entityType: 'department', entityId: id, before: { name: current.name, code: current.code }, after: { deletedAt: now, positionsDeleted: positions.count } },
        tx,
      );
    });
  }

  private async load(id: string) {
    const row = isUuid(id)
      ? await this.prisma.department.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, name: true, code: true, description: true, headEmployeeId: true, isActive: true },
        })
      : null;
    if (!row) throw new NotFoundException();
    return row;
  }

  private async assertHead(employeeId: string): Promise<void> {
    const head = await this.prisma.employee.count({ where: { id: employeeId, ...ACTIVE_EMPLOYEE } });
    if (!head) throw invalidFields({ headEmployeeId: 'Choose an active employee as head' });
  }

  private async assertUnique(values: { name?: string; code?: string }, excludeId?: string): Promise<void> {
    const errors: Record<string, string> = {};
    const notSelf = excludeId ? { id: { not: excludeId } } : {};
    // Names and codes are compared case-insensitively, as people read them
    if (values.name && (await this.prisma.department.count({ where: { name: { equals: values.name, mode: 'insensitive' }, deletedAt: null, ...notSelf } }))) {
      errors.name = 'Another department already has this name';
    }
    if (values.code && (await this.prisma.department.count({ where: { code: values.code, deletedAt: null, ...notSelf } }))) {
      errors.code = 'Another department already uses this code';
    }
    if (Object.keys(errors).length > 0) throw conflict('Some details are already used by another department', errors);
  }

  private async uniqueGuard<T>(values: { name?: string; code?: string }, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        await this.assertUnique(values);
        throw conflict('Some details are already used by another department');
      }
      throw error;
    }
  }
}
