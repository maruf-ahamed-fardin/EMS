import { DEFAULT_ROLE_GRANTS, SYSTEM_ROLES, type SystemRoleKey } from '@ems/contracts';
import type { SessionUser } from './session';

/**
 * Development-only stand-in for authentication, so the app shell and the permission-driven menu
 * can be checked before Phase 2 builds real sign-in. Production builds never accept it.
 * Delete this file (and /preview-session) when Phase 2 lands.
 */
export const PREVIEW_ENABLED = process.env.NODE_ENV !== 'production';

const TOKEN_PREFIX = 'preview.';

const PREVIEW_PEOPLE: Record<SystemRoleKey, { name: string; email: string }> = {
  super_admin: { name: 'Nusrat Jahan', email: 'superadmin@demo.selorax.test' },
  hr_admin: { name: 'Farhana Akter', email: 'hr@demo.selorax.test' },
  manager: { name: 'Tanvir Hasan', email: 'manager@demo.selorax.test' },
  employee: { name: 'Rahim Ahmed', email: 'employee@demo.selorax.test' },
};

export function isSystemRoleKey(value: string | null | undefined): value is SystemRoleKey {
  return !!value && Object.hasOwn(SYSTEM_ROLES, value);
}

export function previewToken(role: SystemRoleKey): string {
  return `${TOKEN_PREFIX}${role}`;
}

export function previewSessionFor(token: string): SessionUser | null {
  if (!PREVIEW_ENABLED || !token.startsWith(TOKEN_PREFIX)) return null;
  const role = token.slice(TOKEN_PREFIX.length);
  if (!isSystemRoleKey(role)) return null;

  return {
    id: `preview-${role}`,
    ...PREVIEW_PEOPLE[role],
    roleKey: role,
    roleName: SYSTEM_ROLES[role].name,
    permissions: DEFAULT_ROLE_GRANTS[role],
    preview: true,
  };
}
