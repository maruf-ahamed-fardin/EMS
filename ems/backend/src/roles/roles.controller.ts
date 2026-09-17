import { Controller, Get } from '@nestjs/common';
import type { DataResponse, PermissionScope } from '@ems/contracts';
import { RequirePermission } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Record<string, PermissionScope>;
}

interface PermissionView {
  key: string;
  module: string;
  description: string;
}

/** Read side of Roles & permissions. Editing grants (`PUT /roles/:id/permissions`) arrives in Phase 12. */
@Controller()
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('role.manage')
  @Get('roles')
  async roles(): Promise<DataResponse<RoleView[]>> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        _count: { select: { users: true } },
        permissions: { select: { scope: true, permission: { select: { key: true } } } },
      },
    });
    return {
      data: roles.map(({ _count, permissions, ...role }) => ({
        ...role,
        userCount: _count.users,
        permissions: Object.fromEntries(permissions.map((grant) => [grant.permission.key, grant.scope])),
      })),
    };
  }

  @RequirePermission('role.manage')
  @Get('permissions')
  async permissions(): Promise<DataResponse<PermissionView[]>> {
    return {
      data: await this.prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { key: 'asc' }],
        select: { key: true, module: true, description: true },
      }),
    };
  }
}
