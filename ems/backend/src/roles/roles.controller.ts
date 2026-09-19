import { Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Put } from '@nestjs/common';
import { type DataResponse, isPermissionKey, type PermissionItem, type PermissionMap, type RoleItem, updateRolePermissionsInput } from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import { AuditService } from '../audit/audit.service';
import { SUPER_ADMIN } from '../auth/account-protection';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { PermissionsService } from '../auth/permissions.service';
import { conflict } from '../common/errors/http-errors';
import { PrismaService } from '../prisma/prisma.service';

class UpdateRolePermissionsDto extends createZodDto(updateRolePermissionsInput) {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_PERMISSIONS = new Set<string>(['user.manage', 'role.manage']);

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  _count: { select: { users: true } },
  permissions: { select: { scope: true, permission: { select: { key: true } } } },
} as const;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(auth: AuthContext): Promise<RoleItem[]> {
    const roles = await this.prisma.role.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], select: ROLE_SELECT });
    return roles.map(({ _count, permissions, ...role }) => ({
      ...role,
      userCount: _count.users,
      permissions: Object.fromEntries(permissions.filter((g) => isPermissionKey(g.permission.key)).map((g) => [g.permission.key, g.scope])),
      editable: role.key !== SUPER_ADMIN && role.id !== auth.user.role.id,
    }));
  }

  /**
   * Replaces a role's grants with exactly the ones given. Applies at once on this instance (the
   * permission cache is cleared) and within a minute on others.
   */
  async replace(auth: AuthContext, id: string, grants: PermissionMap): Promise<RoleItem> {
    const role = UUID.test(id) ? await this.prisma.role.findUnique({ where: { id }, select: ROLE_SELECT }) : null;
    if (!role) throw new NotFoundException();
    if (role.key === SUPER_ADMIN) throw conflict('Super Admin always has every permission, so it can’t be edited');
    if (role.id === auth.user.role.id) throw conflict("You can't change your own role's permissions. Ask another administrator.");

    const before = Object.fromEntries(role.permissions.map((g) => [g.permission.key, g.scope])) as PermissionMap;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(grants)])].filter((k) => before[k as keyof PermissionMap] !== grants[k as keyof PermissionMap]);
    if (changed.length === 0) {
      this.audit.skip('Nothing changed');
      return (await this.list(auth)).find((r) => r.id === id)!;
    }
    // Either of these lets the holder reach Super Admin's powers, so only a Super Admin hands them out
    if (changed.some((k) => ADMIN_PERMISSIONS.has(k)) && auth.user.role.key !== SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can grant or remove user and role management');
    }

    const catalogue = new Map((await this.prisma.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]));
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: Object.entries(grants).map(([key, scope]) => ({ roleId: id, permissionId: catalogue.get(key)!, scope })),
      });
      await this.audit.record(
        {
          action: 'role.permissions_changed',
          entityType: 'role',
          entityId: id,
          before: { key: role.key, permissions: Object.fromEntries(changed.map((k) => [k, before[k as keyof PermissionMap] ?? null])) },
          after: { key: role.key, permissions: Object.fromEntries(changed.map((k) => [k, grants[k as keyof PermissionMap] ?? null])) },
        },
        tx,
      );
    });
    this.permissions.invalidate(id);
    return (await this.list(auth)).find((r) => r.id === id)!;
  }
}

/** Roles & permissions (plan §4). Every role's grants are edited here, except Super Admin's. */
@Controller()
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly prisma: PrismaService,
  ) {}

  @RequirePermission('role.manage')
  @Get('roles')
  async list(@CurrentAuth() auth: AuthContext): Promise<DataResponse<RoleItem[]>> {
    return { data: await this.roles.list(auth) };
  }

  @RequirePermission('role.manage')
  @Put('roles/:id/permissions')
  async replace(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: UpdateRolePermissionsDto): Promise<DataResponse<RoleItem>> {
    return { data: await this.roles.replace(auth, id, body.permissions) };
  }

  @RequirePermission('role.manage')
  @Get('permissions')
  async permissions(): Promise<DataResponse<PermissionItem[]>> {
    const rows = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }], select: { key: true, module: true, description: true } });
    return { data: rows.filter((p): p is PermissionItem => isPermissionKey(p.key)) };
  }
}
