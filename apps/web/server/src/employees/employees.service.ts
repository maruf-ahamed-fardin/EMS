import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  can,
  type CreateEmployeeData,
  type EmployeeActivityItem,
  type EmployeeDetail,
  type EmployeeFormOptions,
  type EmployeeListItem,
  type EmployeeListQuery,
  type ListResponse,
  pageMeta,
  type UniquenessResult,
  type UpdateEmployeeInput,
  type UpdateMyProfileInput,
} from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { assertMayChangeAccount, assertSuperAdminRemains, mayChangeAccount, revokePasswordLinks, SUPER_ADMIN } from '../auth/account-protection';
import { InvitationService } from '../auth/invitations.service';
import { SessionsService } from '../auth/sessions.service';
import { Clock } from '../common/clock';
import { conflict, invalidFields } from '../common/errors/http-errors';
import { InjectConfig, type AppConfig } from '../config/config.module';
import type { Prisma } from '../generated/prisma/client';
import { cancelPendingLeave } from '../leave/leave-ledger';
import { PrismaService } from '../prisma/prisma.service';
import {
  createsManagerCycle,
  employeeFilters,
  employeeOrderBy,
  fromDateOnly,
  nextEmployeeCode,
  organizationYear,
  toDateOnly,
} from './employee-query';
import { proratedAllocation } from '../leave/leave-rules';
import { NotificationService } from '../notifications/notifications.service';
import { shortDate } from '../notifications/wording';
import { EMPLOYEE_DETAIL_SELECT, EMPLOYEE_LIST_SELECT, toDetail, toListItem } from './employee-view';

type Tx = Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly invitations: InvitationService,
    @InjectConfig() private readonly config: AppConfig,
    private readonly notifications: NotificationService,
    private readonly clock: Clock,
  ) {}

  // ─── Read ───────────────────────────────────────────────────────────────────────────────────

  async list(auth: AuthContext, query: EmployeeListQuery): Promise<ListResponse<EmployeeListItem>> {
    const where: Prisma.EmployeeWhereInput = { AND: [this.scope.employeeWhere(auth, 'employee.view'), employeeFilters(query)] };
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: EMPLOYEE_LIST_SELECT,
        orderBy: employeeOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data: rows.map(toListItem), meta: pageMeta(query.page, query.limit, total) };
  }

  /** 404 when the record doesn't exist or is outside the caller's view scope. */
  async get(auth: AuthContext, id: string): Promise<EmployeeDetail> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.employee.findFirst({
      where: this.scope.employeeById(auth, 'employee.view', id),
      select: EMPLOYEE_DETAIL_SELECT,
    });
    if (!row) throw new NotFoundException();

    const target = { id: row.id, managerId: row.managerId };
    const isSelf = auth.user.employeeId === row.id;
    // The record's status decides whether their account can sign in, so it follows the account rules too
    const accountOk = !row.user || mayChangeAccount(auth, row.user.role.key);
    const canUpdate = this.scope.reaches(auth, 'employee.update', target);
    return toDetail(row, {
      showPrivate: this.scope.reaches(auth, 'employee.view_private', target),
      showAccount: can(auth.permissions, 'user.view'),
      allowedActions: {
        update: canUpdate,
        changeEmail: canUpdate && (!row.user || this.mayChangeSignInEmail(auth, row.user.role.key)),
        deactivate: canUpdate && accountOk && !isSelf && row.status === 'ACTIVE',
        reactivate: canUpdate && accountOk && row.status === 'INACTIVE',
        delete: this.scope.reaches(auth, 'employee.delete', target) && accountOk && !isSelf && row.status === 'INACTIVE',
      },
    });
  }

  async activity(auth: AuthContext, id: string, page: number, limit: number): Promise<ListResponse<EmployeeActivityItem>> {
    await this.assertVisible(auth, id);
    const where: Prisma.AuditLogWhereInput = { entityType: 'employee', entityId: id };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          before: true,
          after: true,
          createdAt: true,
          actor: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actor: row.actor ? (row.actor.employee ? `${row.actor.employee.firstName} ${row.actor.employee.lastName}` : row.actor.email) : null,
        // Values can include private fields, so the timeline only says which fields changed
        changedFields: [...new Set([...Object.keys(asObject(row.before)), ...Object.keys(asObject(row.after))])].sort(),
        createdAt: row.createdAt.toISOString(),
      })),
      meta: pageMeta(page, limit, total),
    };
  }

  async formOptions(auth: AuthContext): Promise<EmployeeFormOptions> {
    this.assertCanEdit(auth);
    const [departments, positions, managers, roles, codes] = await Promise.all([
      this.prisma.department.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
      this.prisma.position.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { title: 'asc' }, select: { id: true, title: true, departmentId: true } }),
      this.prisma.employee.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, employeeCode: true, position: { select: { title: true } } },
      }),
      this.prisma.role.findMany({ orderBy: { name: 'asc' }, select: { key: true, name: true } }),
      this.prisma.employee.findMany({ select: { employeeCode: true } }),
    ]);
    return {
      departments,
      positions,
      managers: managers.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, employeeCode: m.employeeCode, positionTitle: m.position.title })),
      roles: can(auth.permissions, 'user.manage') ? roles.filter((role) => mayChangeAccount(auth, role.key)) : roles.filter((role) => role.key === 'employee'),
      nextEmployeeCode: nextEmployeeCode(codes.map((c) => c.employeeCode)),
    };
  }

  async checkUnique(auth: AuthContext, input: { email?: string; employeeCode?: string; excludeId?: string }): Promise<UniquenessResult> {
    this.assertCanEdit(auth);
    const result: UniquenessResult = {};
    const notSelf = input.excludeId ? { id: { not: input.excludeId } } : {};
    if (input.email) {
      const taken = await this.prisma.employee.findFirst({ where: { email: input.email, deletedAt: null, ...notSelf }, select: { employeeCode: true } });
      result.email = taken ? { available: false, takenBy: taken.employeeCode } : { available: true };
    }
    if (input.employeeCode) {
      const taken = await this.prisma.employee.count({ where: { employeeCode: input.employeeCode, deletedAt: null, ...notSelf } });
      result.employeeCode = { available: taken === 0 };
    }
    return result;
  }

  // ─── Create ─────────────────────────────────────────────────────────────────────────────────

  async create(auth: AuthContext, input: CreateEmployeeData): Promise<EmployeeDetail> {
    await this.validateReferences({ departmentId: input.departmentId, positionId: input.positionId, managerId: input.managerId ?? null });

    let roleId: string | null = null;
    if (input.createAccount) {
      if (input.roleKey !== 'employee' && !can(auth.permissions, 'user.manage')) {
        throw invalidFields({ roleKey: 'You can only give new accounts the Employee role' });
      }
      assertMayChangeAccount(auth, input.roleKey);
      const role = await this.prisma.role.findUnique({ where: { key: input.roleKey }, select: { id: true } });
      if (!role) throw invalidFields({ roleKey: 'Choose a role' });
      roleId = role.id;
      if (await this.prisma.user.count({ where: { email: input.email } })) {
        throw conflict('That email already has a sign-in account', { email: 'A sign-in account already uses this email' });
      }
    }
    await this.assertUnique({ email: input.email, employeeCode: input.employeeCode });

    // A random, never-revealed password: the person chooses theirs from the emailed link
    const unusablePasswordHash = roleId ? await this.invitations.unusablePasswordHash() : null;
    let inviteToken: string | null = null;

    const created = await this.withConflictMapping({ email: input.email, employeeCode: input.employeeCode }, () =>
      this.prisma.$transaction(async (tx) => {
        const employeeCode = input.employeeCode ?? (await this.allocateCode(tx));
        const employee = await tx.employee.create({
          data: {
            employeeCode,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            dateOfBirth: toDateOnly(input.dateOfBirth),
            gender: input.gender ?? null,
            address: input.address,
            emergencyContact: input.emergencyContact,
            departmentId: input.departmentId,
            positionId: input.positionId,
            managerId: input.managerId ?? null,
            joiningDate: toDateOnly(input.joiningDate),
            employmentType: input.employmentType,
            workLocation: input.workLocation,
          },
          select: { id: true },
        });

        // This year's balances for every active paid leave type, prorated from the joining date (plan §7)
        const year = organizationYear(this.clock.now());
        const leaveTypes = await tx.leaveType.findMany({ where: { deletedAt: null, isActive: true, isPaid: true }, select: { id: true, defaultDaysPerYear: true } });
        if (leaveTypes.length > 0 && input.joiningDate <= `${year}-12-31`) {
          await tx.leaveBalance.createMany({
            data: leaveTypes.map((type) => ({
              employeeId: employee.id,
              leaveTypeId: type.id,
              year,
              allocated: proratedAllocation(Number(type.defaultDaysPerYear), input.joiningDate, year),
            })),
          });
        }

        if (roleId && unusablePasswordHash) {
          const user = await tx.user.create({
            data: { email: input.email, passwordHash: unusablePasswordHash, roleId, employeeId: employee.id },
            select: { id: true },
          });
          inviteToken = await this.invitations.issue(tx, user.id);
          await this.audit.record({ action: 'user.created', entityType: 'user', entityId: user.id, after: { email: input.email, roleId, employeeId: employee.id } }, tx);
        }

        await this.audit.record(
          { action: 'employee.created', entityType: 'employee', entityId: employee.id, after: { ...input, employeeCode, accountCreated: !!roleId } },
          tx,
        );

        // Tells HR (everyone who sees all employees), except whoever just added the person (plan §9)
        const department = await tx.department.findUniqueOrThrow({ where: { id: input.departmentId }, select: { name: true } });
        const position = await tx.position.findUniqueOrThrow({ where: { id: input.positionId }, select: { title: true } });
        const hr = await this.notifications.usersWithAll('employee.view', tx);
        await this.notifications.notify(
          {
            userIds: hr.filter((id) => id !== auth.user.id),
            type: 'employee.created',
            title: `${input.firstName} ${input.lastName} joins ${department.name}`,
            body: `${employeeCode} · ${position.title} · starts ${shortDate(input.joiningDate)}`,
            link: `/employees/${employee.id}`,
            entity: { type: 'employee', id: employee.id },
            dedupeKey: `employee-created:${employee.id}`,
          },
          tx,
        );
        return employee;
      }),
    );

    if (inviteToken) this.invitations.send(input.email, input.firstName, inviteToken, 'new');
    return this.get(auth, created.id);
  }

  /** The next SX code, taken under an advisory lock so two creates can't pick the same one. */
  private async allocateCode(tx: Tx): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('employees.employee_code'))`;
    const codes = await tx.employee.findMany({ select: { employeeCode: true } });
    return nextEmployeeCode(codes.map((c) => c.employeeCode));
  }

  // ─── Update ─────────────────────────────────────────────────────────────────────────────────

  async update(auth: AuthContext, id: string, input: UpdateEmployeeInput): Promise<EmployeeDetail> {
    const current = await this.loadForChange(auth, id, 'employee.update');
    const changes = changedFields(current, input);
    if (Object.keys(changes).length === 0) {
      this.audit.skip('Nothing changed');
      return this.get(auth, id);
    }

    const departmentId = (changes.departmentId as string | undefined) ?? current.departmentId;
    const positionId = (changes.positionId as string | undefined) ?? current.positionId;
    const managerId = 'managerId' in changes ? ((changes.managerId as string | null) ?? null) : current.managerId;
    if ('departmentId' in changes || 'positionId' in changes || 'managerId' in changes) {
      await this.validateReferences({ departmentId, positionId, managerId }, id);
    }

    const email = changes.email as string | undefined;
    const employeeCode = changes.employeeCode as string | undefined;
    // Changing the sign-in email is taking over the account's password resets, so it is an account change
    if (email && current.user && !this.mayChangeSignInEmail(auth, current.user.role.key)) {
      throw new ForbiddenException('This work email is also their sign-in email. Ask someone who manages user accounts to change it.');
    }
    await this.assertUnique({ email, employeeCode }, id);
    if (email && current.user && (await this.prisma.user.count({ where: { email, id: { not: current.user.id } } }))) {
      throw conflict('That email already has a sign-in account', { email: 'A sign-in account already uses this email' });
    }

    await this.withConflictMapping({ email, employeeCode }, () =>
      this.prisma.$transaction(async (tx) => {
        await tx.employee.update({ where: { id }, data: toUpdateData(changes) });
        // The work email is also the sign-in email. Sessions and links made for the old address end.
        if (email && current.user) {
          await tx.user.update({ where: { id: current.user.id }, data: { email } });
          await this.sessions.revokeAllForUser(current.user.id, {}, tx);
          await revokePasswordLinks(tx, current.user.id);
        }
        await this.audit.record(
          { action: 'employee.updated', entityType: 'employee', entityId: id, before: pick(snapshot(current), Object.keys(changes)), after: changes },
          tx,
        );
      }),
    );
    if (email && current.user) this.invitations.sendSignInEmailChanged(current.email, current.firstName, email);
    return this.get(auth, id);
  }

  async deactivate(auth: AuthContext, id: string): Promise<EmployeeDetail> {
    const current = await this.loadForChange(auth, id, 'employee.update');
    if (auth.user.employeeId === id) throw conflict("You can't deactivate your own record");
    if (current.status !== 'ACTIVE') throw conflict('This employee is already inactive');
    if (current.user) assertMayChangeAccount(auth, current.user.role.key);

    await this.prisma.$transaction(async (tx) => {
      if (current.user?.role.key === SUPER_ADMIN) await assertSuperAdminRemains(tx, current.user.id, 'This is the only active Super Admin. Make someone else Super Admin first.');
      const now = new Date();
      await tx.employee.update({ where: { id }, data: { status: 'INACTIVE', deactivatedAt: now } });
      const sessionsRevoked = current.user ? await this.sessions.revokeAllForUser(current.user.id, {}, tx) : 0;
      if (current.user) await revokePasswordLinks(tx, current.user.id);
      const leaveRequestsCancelled = await cancelPendingLeave(tx, id, 'Cancelled automatically: the employee was deactivated', organizationYear(this.clock.now()));
      await this.audit.record(
        {
          action: 'employee.deactivated',
          entityType: 'employee',
          entityId: id,
          before: { status: 'ACTIVE' },
          after: { status: 'INACTIVE', deactivatedAt: now, sessionsRevoked, leaveRequestsCancelled },
        },
        tx,
      );
    });
    return this.get(auth, id);
  }

  async reactivate(auth: AuthContext, id: string): Promise<EmployeeDetail> {
    const current = await this.loadForChange(auth, id, 'employee.update');
    if (current.status !== 'INACTIVE') throw conflict('This employee is already active');
    // Reactivating the record lets their account sign in again
    if (current.user) assertMayChangeAccount(auth, current.user.role.key);
    // Their department or position may have been deleted or turned off while they were away
    const [department, position] = await Promise.all([
      this.prisma.department.count({ where: { id: current.departmentId, deletedAt: null, isActive: true } }),
      this.prisma.position.count({ where: { id: current.positionId, deletedAt: null, isActive: true } }),
    ]);
    if (!department || !position) {
      throw conflict('Their department or position no longer exists. Edit the record to choose current ones, then reactivate.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { status: 'ACTIVE', deactivatedAt: null } });
      await this.audit.record({ action: 'employee.reactivated', entityType: 'employee', entityId: id, before: { status: 'INACTIVE' }, after: { status: 'ACTIVE' } }, tx);
    });
    return this.get(auth, id);
  }

  /** Soft delete (assumption 10). Only an inactive record, so nobody is removed by one mistaken click. */
  async remove(auth: AuthContext, id: string): Promise<void> {
    const current = await this.loadForChange(auth, id, 'employee.delete');
    if (auth.user.employeeId === id) throw conflict("You can't delete your own record");
    if (current.status !== 'INACTIVE') throw conflict('Deactivate this employee before deleting the record');
    if (current.user) assertMayChangeAccount(auth, current.user.role.key);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.employee.update({ where: { id }, data: { deletedAt: now } });
      if (current.user) {
        await tx.user.update({ where: { id: current.user.id }, data: { status: 'INACTIVE' } });
        await this.sessions.revokeAllForUser(current.user.id, {}, tx);
        await revokePasswordLinks(tx, current.user.id);
      }
      // Nobody keeps reporting to, or being headed by, a deleted record
      await tx.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.department.updateMany({ where: { headEmployeeId: id }, data: { headEmployeeId: null } });
      await this.audit.record({ action: 'employee.deleted', entityType: 'employee', entityId: id, after: { deletedAt: now } }, tx);
    });
  }

  // ─── Self-service (/me/profile) ─────────────────────────────────────────────────────────────

  async myProfile(auth: AuthContext): Promise<EmployeeDetail> {
    if (!auth.user.employeeId) throw new NotFoundException('No employee record is linked to your account');
    return this.get(auth, auth.user.employeeId);
  }

  async updateMyProfile(auth: AuthContext, input: UpdateMyProfileInput): Promise<EmployeeDetail> {
    const id = auth.user.employeeId;
    if (!id) throw new NotFoundException('No employee record is linked to your account');
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null }, select: CHANGE_SELECT });
    if (!current) throw new NotFoundException('No employee record is linked to your account');

    const changes = changedFields(current, input);
    if (Object.keys(changes).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.employee.update({ where: { id }, data: toUpdateData(changes) });
        await this.audit.record(
          { action: 'employee.updated', entityType: 'employee', entityId: id, before: pick(snapshot(current), Object.keys(changes)), after: changes },
          tx,
        );
      });
    } else {
      this.audit.skip('Nothing changed');
    }
    return this.get(auth, id);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────────────────────

  private mayChangeSignInEmail(auth: AuthContext, roleKey: string): boolean {
    return can(auth.permissions, 'user.manage') && mayChangeAccount(auth, roleKey);
  }

  private assertCanEdit(auth: AuthContext): void {
    if (!can(auth.permissions, 'employee.create') && !can(auth.permissions, 'employee.update')) throw new ForbiddenException();
  }

  private async assertVisible(auth: AuthContext, id: string): Promise<void> {
    if (!UUID.test(id)) throw new NotFoundException();
    const visible = await this.prisma.employee.count({ where: this.scope.employeeById(auth, 'employee.view', id) });
    if (!visible) throw new NotFoundException();
  }

  /** Loads a record the caller may change with `key`; 404 when it is outside that scope. */
  private async loadForChange(auth: AuthContext, id: string, key: 'employee.update' | 'employee.delete') {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.employee.findFirst({ where: this.scope.employeeById(auth, key, id), select: CHANGE_SELECT });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async validateReferences(refs: { departmentId: string; positionId: string; managerId: string | null }, employeeId?: string) {
    const [department, position, manager] = await Promise.all([
      this.prisma.department.findFirst({ where: { id: refs.departmentId, deletedAt: null, isActive: true }, select: { name: true } }),
      this.prisma.position.findFirst({ where: { id: refs.positionId, deletedAt: null, isActive: true }, select: { departmentId: true } }),
      refs.managerId
        ? this.prisma.employee.findFirst({ where: { id: refs.managerId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    const errors: Record<string, string> = {};
    if (!department) errors.departmentId = 'Choose an active department';
    if (!position) errors.positionId = 'Choose an active position';
    else if (department && position.departmentId && position.departmentId !== refs.departmentId) {
      errors.positionId = `Choose a position in ${department.name}`;
    }
    if (refs.managerId && !manager) errors.managerId = 'Choose an active employee as manager';
    if (employeeId && refs.managerId === employeeId) errors.managerId = "Someone can't be their own manager";
    if (Object.keys(errors).length > 0) throw invalidFields(errors);

    if (employeeId && refs.managerId) {
      const loops = await createsManagerCycle(employeeId, refs.managerId, async (id) =>
        (await this.prisma.employee.findUnique({ where: { id }, select: { managerId: true } }))?.managerId ?? null,
      );
      if (loops) throw invalidFields({ managerId: 'This person already reports to this employee, directly or indirectly' });
    }
  }

  private async assertUnique(values: { email?: string; employeeCode?: string }, excludeId?: string): Promise<void> {
    const errors = await this.uniquenessErrors(values, excludeId);
    if (Object.keys(errors).length > 0) throw conflict('Some details are already used by another employee', errors);
  }

  private async uniquenessErrors(values: { email?: string; employeeCode?: string }, excludeId?: string): Promise<Record<string, string>> {
    const notSelf = excludeId ? { id: { not: excludeId } } : {};
    const errors: Record<string, string> = {};
    if (values.email) {
      const taken = await this.prisma.employee.findFirst({ where: { email: values.email, deletedAt: null, ...notSelf }, select: { employeeCode: true } });
      if (taken) errors.email = `Already used by ${taken.employeeCode}`;
    }
    if (values.employeeCode) {
      const taken = await this.prisma.employee.count({ where: { employeeCode: values.employeeCode, deletedAt: null, ...notSelf } });
      if (taken) errors.employeeCode = 'This employee ID is already taken';
    }
    return errors;
  }

  /**
   * The pre-checks give friendly messages, but a parallel request can still win the race; the unique
   * index is what actually stops duplicates (plan §7). Its error becomes the same 409.
   */
  private async withConflictMapping<T>(values: { email?: string; employeeCode?: string }, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const errors = await this.uniquenessErrors(values);
        throw conflict('Some details are already used by another employee', Object.keys(errors).length ? errors : undefined);
      }
      throw error;
    }
  }
}

const CHANGE_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  address: true,
  emergencyContact: true,
  departmentId: true,
  positionId: true,
  managerId: true,
  joiningDate: true,
  employmentType: true,
  workLocation: true,
  status: true,
  user: { select: { id: true, role: { select: { key: true } } } },
} satisfies Prisma.EmployeeSelect;

type ChangeRow = Prisma.EmployeeGetPayload<{ select: typeof CHANGE_SELECT }>;

/** The record in input shape (dates as YYYY-MM-DD), for comparing and auditing. */
function snapshot(row: ChangeRow): Record<string, unknown> {
  return {
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    dateOfBirth: fromDateOnly(row.dateOfBirth),
    gender: row.gender ?? undefined,
    address: row.address,
    emergencyContact: row.emergencyContact,
    departmentId: row.departmentId,
    positionId: row.positionId,
    managerId: row.managerId,
    joiningDate: fromDateOnly(row.joiningDate),
    employmentType: row.employmentType,
    workLocation: row.workLocation,
  };
}

/** Only the fields whose value actually changes, so audit rows and updates stay minimal. */
export function changedFields(row: ChangeRow, input: Record<string, unknown>): Record<string, unknown> {
  const before = snapshot(row);
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (JSON.stringify(normalize(before[key])) !== JSON.stringify(normalize(value))) changes[key] = value;
  }
  return changes;
}

function normalize(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return value ?? null;
}

function toUpdateData(changes: Record<string, unknown>): Prisma.EmployeeUncheckedUpdateInput {
  const data: Record<string, unknown> = { ...changes };
  for (const key of ['dateOfBirth', 'joiningDate'] as const) {
    if (typeof data[key] === 'string') data[key] = toDateOnly(data[key]);
  }
  return data;
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

