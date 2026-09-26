import { DEFAULT_ROLE_GRANTS, PERMISSION_KEYS, PERMISSIONS, SYSTEM_ROLES, type SystemRoleKey } from '@/lib/validations';
import type { PrismaClient } from '@/lib/db/generated/prisma/client';

export interface CatalogueSummary {
  permissionsUpserted: number;
  permissionsRemoved: number;
  /** Keys added to the catalogue by this run; existing system roles received their default grants. */
  permissionsAdded: string[];
  rolesCreated: string[];
}

/**
 * Makes the database's permission catalogue and system roles match @ems/contracts. Safe to run on
 * every deploy:
 * - permissions are upserted, and keys no longer in the catalogue are removed (with their grants);
 * - a system role that doesn't exist yet is created with its default grants;
 * - an existing role keeps the grants someone set in Roles & permissions, except Super Admin, which
 *   always holds every permission (so a new module is never unreachable);
 * - a permission that is new to this database is granted to the existing system roles whose defaults
 *   include it. Nobody has decided about it yet, so the default is the only choice there is.
 */
export async function syncCatalogue(prisma: PrismaClient): Promise<CatalogueSummary> {
  return prisma.$transaction(async (tx) => {
    const known = new Set((await tx.permission.findMany({ select: { key: true } })).map((p) => p.key));
    // On an empty database every key is "new", but roles don't exist yet and get all their defaults below
    const permissionsAdded = known.size === 0 ? [] : PERMISSION_KEYS.filter((key) => !known.has(key));
    for (const key of PERMISSION_KEYS) {
      const { module, description } = PERMISSIONS[key];
      await tx.permission.upsert({ where: { key }, create: { key, module, description }, update: { module, description } });
    }
    const removed = await tx.permission.deleteMany({ where: { key: { notIn: PERMISSION_KEYS } } });
    const permissionIds = new Map((await tx.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]));

    const rolesCreated: string[] = [];
    for (const roleKey of Object.keys(SYSTEM_ROLES) as SystemRoleKey[]) {
      const { name, description } = SYSTEM_ROLES[roleKey];
      const existing = await tx.role.findUnique({ where: { key: roleKey }, select: { id: true } });
      const role = existing
        ? await tx.role.update({ where: { id: existing.id }, data: { name, description, isSystem: true }, select: { id: true } })
        : await tx.role.create({ data: { key: roleKey, name, description, isSystem: true }, select: { id: true } });

      if (!existing || roleKey === 'super_admin') {
        if (!existing) rolesCreated.push(roleKey);
        for (const [permissionKey, scope] of Object.entries(DEFAULT_ROLE_GRANTS[roleKey])) {
          const permissionId = permissionIds.get(permissionKey);
          if (!permissionId || !scope) continue;
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId } },
            create: { roleId: role.id, permissionId, scope },
            update: roleKey === 'super_admin' ? { scope } : {},
          });
        }
      } else {
        for (const permissionKey of permissionsAdded) {
          const scope = DEFAULT_ROLE_GRANTS[roleKey][permissionKey];
          const permissionId = permissionIds.get(permissionKey);
          if (!scope || !permissionId) continue;
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId } },
            create: { roleId: role.id, permissionId, scope },
            update: {},
          });
        }
      }
    }

    return { permissionsUpserted: PERMISSION_KEYS.length, permissionsRemoved: removed.count, permissionsAdded, rolesCreated };
  });
}
