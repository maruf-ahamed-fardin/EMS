import 'server-only';
import type { PermissionMap } from '@ems/contracts';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { SESSION_COOKIE } from './auth-paths';
import { previewSessionFor } from './preview-session';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  permissions: PermissionMap;
  /** True for the development-only preview session (Phase 1, removed in Phase 2). */
  preview: boolean;
}

/**
 * The signed-in user, or null. Cached per request, so the layout and the page share one lookup.
 *
 * Phase 2 replaces the body with `GET /api/v1/auth/me`, forwarding the cookie, and nothing that
 * calls this changes.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return previewSessionFor(token);
});
