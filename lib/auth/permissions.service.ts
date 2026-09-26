import { Injectable } from '@nestjs/common';
import { isPermissionKey, type PermissionMap } from '@/lib/validations';
import { PrismaService } from '@/lib/db/prisma';

const CACHE_TTL_MS = 60_000;

/**
 * A role's granted permissions, cached for 60 seconds (plan §4). A change made in Roles & permissions
 * calls `invalidate` so it applies at once on this instance, and within a minute elsewhere.
 */
@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, { map: PermissionMap; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async forRole(roleId: string): Promise<PermissionMap> {
    const cached = this.cache.get(roleId);
    if (cached && cached.expires > Date.now()) return cached.map;

    const grants = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { scope: true, permission: { select: { key: true } } },
    });
    const map: PermissionMap = {};
    for (const grant of grants) {
      // A key removed from the catalogue but still in the table grants nothing
      if (isPermissionKey(grant.permission.key)) map[grant.permission.key] = grant.scope;
    }
    this.cache.set(roleId, { map, expires: Date.now() + CACHE_TTL_MS });
    return map;
  }

  invalidate(roleId?: string): void {
    if (roleId) this.cache.delete(roleId);
    else this.cache.clear();
  }
}
