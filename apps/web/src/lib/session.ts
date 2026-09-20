import 'server-only';
import { type DataResponse, type MeResponse, SESSION_COOKIE } from '@ems/contracts';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { readApiError } from './api-error';
import { serverApi } from './server-api';

export type SessionUser = MeResponse;

/**
 * The signed-in user from `GET /api/v1/auth/me`, or null when there is no valid session. Cached per
 * request, so the layout and the page share one call. Any other failure (API down) throws, and the
 * route's error boundary shows it rather than pretending the user is signed out.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  if (!(await cookies()).has(SESSION_COOKIE)) return null;

  const response = await serverApi('/auth/me');
  if (response.status === 401) return null;
  if (!response.ok) throw await readApiError(response);
  return ((await response.json()) as DataResponse<MeResponse>).data;
});
