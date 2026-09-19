import { Injectable, NotFoundException } from '@nestjs/common';
import { can, type CreateUserInput, type ListResponse, pageMeta, type UserFormOptions, type UserListItem, type UserListQuery } from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { InvitationService } from '../auth/invitations.service';
import { displayName, SessionsService } from '../auth/sessions.service';
import { conflict, invalidFields } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPER_ADMIN = 'super_admin';

const USER_SELECT = {
  id: true,
  email: true,
  status: true,
  lockedUntil: true,
  lastLoginAt: true,
  role: { select: { id: true, key: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, status: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/**
 * Sign-in accounts (plan §6). Accounts belong to employees and get their password through an emailed
 * link, never from an administrator. Two rules keep the organization from locking itself out: nobody
 * changes their own role or deactivates themselves, and the last active Super Admin stays one.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
    private readonly invitations: InvitationService,
  ) {}

  async list(auth: AuthContext, query: UserListQuery): Promise<ListResponse<UserListItem>> {
    const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
    const where: Prisma.UserWhereInput = {
      AND: [
        contains ? { OR: [{ email: contains }, { employee: { OR: [{ firstName: contains }, { lastName: contains }, { employeeCode: contains }] } }] } : {},
        query.roleId ? { roleId: query.roleId } : {},
        query.status ? { status: query.status } : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: [{ email: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit, select: USER_SELECT }),
      this.prisma.user.count({ where }),
    ]);
    return { data: rows.map((row) => this.toItem(auth, row)), meta: pageMeta(query.page, query.limit, total) };
  }

  async options(): Promise<UserFormOptions> {
    const [roles, employees] = await Promise.all([
      this.prisma.role.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], select: { id: true, key: true, name: true, description: true } }),
      this.prisma.employee.findMany({
        where: { deletedAt: null, status: 'ACTIVE', user: null },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true },
      }),
    ]);
    return {
      roles,
      employeesWithoutAccount: employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, employeeCode: e.employeeCode, email: e.email })),
    };
  }

  private toItem(auth: AuthContext, row: UserRow): UserListItem {
    const manage = can(auth.permissions, 'user.manage');
    const self = row.id === auth.user.id;
    const locked = row.lockedUntil !== null && row.lockedUntil > new Date();
    const employeeActive = !row.employee || row.employee.status === 'ACTIVE';
    return {
      id: row.id,
      email: row.email,
      name: displayName(row),
      employee: row.employee ? { id: row.employee.id, name: `${row.employee.firstName} ${row.employee.lastName}`, employeeCode: row.employee.employeeCode, status: row.employee.status } : null,
      role: row.role,
      status: row.status,
      lockedUntil: locked ? row.lockedUntil!.toISOString() : null,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      allowedActions: {
        changeRole: manage && !self,
        deactivate: manage && !self && row.status !== 'INACTIVE',
        activate: manage && (row.status !== 'ACTIVE' || locked) && employeeActive,
        sendReset: manage && row.status === 'ACTIVE',
      },
    };
  }

  private async get(auth: AuthContext, id: string): Promise<UserListItem> {
    return this.toItem(auth, await this.prisma.user.findUniqueOrThrow({ where: { id }, select: USER_SELECT }));
  }

  private async load(id: string): Promise<UserRow> {
    const row = UUID.test(id) ? await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT }) : null;
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Refuses a change that would leave no active Super Admin. */
  private async assertAnotherSuperAdmin(user: UserRow, message: string): Promise<void> {
    if (user.role.key !== SUPER_ADMIN) return;
    const others = await this.prisma.user.count({ where: { id: { not: user.id }, status: 'ACTIVE', role: { key: SUPER_ADMIN } } });
    if (others === 0) throw conflict(message);
  }

  // ─── Changes ────────────────────────────────────────────────────────────────────────────────

  /** An account for an employee without one. They get a 3-day link to choose their password. */
  async create(auth: AuthContext, input: CreateUserInput): Promise<UserListItem> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, deletedAt: null },
      select: { id: true, firstName: true, email: true, status: true, user: { select: { id: true } } },
    });
    if (!employee) throw invalidFields({ employeeId: 'Choose an employee' });
    if (employee.status !== 'ACTIVE') throw invalidFields({ employeeId: 'Reactivate the employee before giving them an account' });
    if (employee.user) throw conflict('This employee already has an account', { employeeId: 'This employee already has an account' });
    if (!(await this.prisma.role.count({ where: { id: input.roleId } }))) throw invalidFields({ roleId: 'Choose a role' });
    if (await this.prisma.user.count({ where: { email: employee.email } })) {
      throw conflict(`Another account already signs in with ${employee.email}`, { employeeId: 'Their work email is already used by another account' });
    }

    const passwordHash = await this.invitations.unusablePasswordHash();
    const { id, token } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: employee.email, passwordHash, roleId: input.roleId, employeeId: employee.id }, select: { id: true } });
      const invite = await this.invitations.issue(tx, user.id);
      await this.audit.record({ action: 'user.created', entityType: 'user', entityId: user.id, after: { email: employee.email, roleId: input.roleId, employeeId: employee.id } }, tx);
      return { id: user.id, token: invite };
    });
    this.invitations.send(employee.email, employee.firstName, token, 'new');
    return this.get(auth, id);
  }

  async changeRole(auth: AuthContext, id: string, roleId: string): Promise<UserListItem> {
    const user = await this.load(id);
    if (user.id === auth.user.id) throw conflict("You can't change your own role. Ask another administrator.");
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true, key: true } });
    if (!role) throw invalidFields({ roleId: 'Choose a role' });
    if (role.id === user.role.id) {
      this.audit.skip('Nothing changed');
      return this.get(auth, id);
    }
    if (role.key !== SUPER_ADMIN) await this.assertAnotherSuperAdmin(user, 'This is the only active Super Admin. Make someone else Super Admin first.');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { roleId } });
      await this.audit.record({ action: 'user.role_changed', entityType: 'user', entityId: id, before: { roleId: user.role.id }, after: { roleId } }, tx);
    });
    // The session guard reads the role on every request, so the new permissions apply at once
    return this.get(auth, id);
  }

  /** Signs the person out everywhere and stops them signing in. The employee record is untouched. */
  async deactivate(auth: AuthContext, id: string): Promise<UserListItem> {
    const user = await this.load(id);
    if (user.id === auth.user.id) throw conflict("You can't deactivate your own account.");
    if (user.status === 'INACTIVE') throw conflict('This account is already inactive');
    await this.assertAnotherSuperAdmin(user, 'This is the only active Super Admin, so it stays active.');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: 'INACTIVE' } });
      const sessionsRevoked = await this.sessions.revokeAllForUser(id, {}, tx);
      await this.audit.record({ action: 'user.deactivated', entityType: 'user', entityId: id, before: { status: user.status }, after: { status: 'INACTIVE', sessionsRevoked } }, tx);
    });
    return this.get(auth, id);
  }

  /** Lets the person sign in again, and lifts a lockout from wrong passwords. */
  async activate(auth: AuthContext, id: string): Promise<UserListItem> {
    const user = await this.load(id);
    if (user.employee && user.employee.status !== 'ACTIVE') throw conflict('Reactivate the employee first; their account follows their employment.');
    const locked = user.lockedUntil !== null && user.lockedUntil > new Date();
    if (user.status === 'ACTIVE' && !locked) throw conflict('This account is already active');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: 'ACTIVE', lockedUntil: null, failedLoginCount: 0 } });
      await this.audit.record(
        { action: 'user.activated', entityType: 'user', entityId: id, before: { status: user.status, lockedUntil: user.lockedUntil }, after: { status: 'ACTIVE', lockedUntil: null } },
        tx,
      );
    });
    return this.get(auth, id);
  }

  /** A new 3-day link to choose a password, for someone who never set one or has forgotten it. */
  async sendReset(auth: AuthContext, id: string): Promise<UserListItem> {
    const user = await this.load(id);
    if (user.status !== 'ACTIVE') throw conflict('Activate the account before sending a password link');
    const token = await this.prisma.$transaction(async (tx) => {
      const issued = await this.invitations.issue(tx, id);
      await this.audit.record({ action: 'user.reset_link_sent', entityType: 'user', entityId: id, after: { email: user.email } }, tx);
      return issued;
    });
    this.invitations.send(user.email, user.employee?.firstName ?? displayName(user), token, 'resend');
    return this.get(auth, id);
  }
}
