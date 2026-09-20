import { z } from 'zod';
import { PermissionScope } from './enums';
import { PERMISSION_KEYS, type PermissionKey, type PermissionMap } from './permissions';

export const SYSTEM_ROLES = {
  super_admin: { name: 'Super Admin', description: 'Full access, including roles and security settings' },
  hr_admin: { name: 'HR / Admin', description: 'Runs day-to-day HR for the whole organization' },
  manager: { name: 'Manager', description: 'Sees and approves for their direct reports' },
  employee: { name: 'Employee', description: 'Sees their own records' },
} as const;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

type Grants = Partial<Record<PermissionKey, PermissionScope>>;

const allOf = (keys: PermissionKey[]): Grants =>
  Object.fromEntries(keys.map((key) => [key, 'ALL'])) as Grants;

/**
 * The default permission matrix (plan §4). It is seeded once and then edited in
 * Roles & Permissions, so at runtime the database is the source of truth, not this object.
 * Permissions that have no meaningful reach (such as `attendance.self`) are granted as ALL.
 */
export const DEFAULT_ROLE_GRANTS: Record<SystemRoleKey, Grants> = {
  super_admin: allOf(PERMISSION_KEYS),

  hr_admin: allOf(PERMISSION_KEYS.filter((key) => key !== 'user.manage' && key !== 'role.manage')),

  manager: {
    'team_profile.view': 'ALL',
    'team_profile.manage_own': 'ALL',
    'employee.view': 'TEAM',
    'department.view': 'ALL',
    'position.view': 'ALL',
    'attendance.view': 'TEAM',
    'attendance.self': 'ALL',
    'leave.view': 'TEAM',
    'leave.create': 'ALL',
    'leave.approve': 'TEAM',
    'leave.reject': 'TEAM',
    'document.view': 'TEAM',
    'notification.view': 'ALL',
    'report.view': 'TEAM',
    'report.export': 'TEAM',
  },

  employee: {
    'team_profile.view': 'ALL',
    'team_profile.manage_own': 'ALL',
    'employee.view': 'OWN',
    'employee.view_private': 'OWN',
    'department.view': 'ALL',
    'position.view': 'ALL',
    'attendance.view': 'OWN',
    'attendance.self': 'ALL',
    'leave.view': 'OWN',
    'leave.create': 'ALL',
    'document.view': 'OWN',
    'document.upload': 'OWN',
    'notification.view': 'ALL',
  },
};

// ─── Roles & permissions screen ─────────────────────────────────────────────────────────────────

export interface RoleItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: PermissionMap;
  /** Super Admin always holds every permission (catalogue sync restores it), so it can't be edited. */
  editable: boolean;
}

export interface PermissionItem {
  key: PermissionKey;
  module: string;
  description: string;
}

/** The complete set of grants for a role; anything left out is taken away. */
export const updateRolePermissionsInput = z.object({
  permissions: z.partialRecord(z.enum(PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]]), z.enum(PermissionScope)),
});
export type UpdateRolePermissionsInput = z.input<typeof updateRolePermissionsInput>;
