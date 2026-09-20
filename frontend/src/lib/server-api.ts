import 'server-only';
import { cookies, headers } from 'next/headers';
import { readApiError } from './api-error';

/** The API as seen from this server. Same variable the /api rewrite uses. */
function apiOrigin(): string {
  return process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';
}

/**
 * Server-side API calls for server components (plan §2): the visitor's cookies are forwarded, so the
 * API applies their session and permissions exactly as for a browser call.
 */
export async function serverApi(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const requestId = (await headers()).get('x-request-id');

  return fetch(`${apiOrigin()}/api/v1${path}`, {
    headers: {
      accept: 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
    cache: 'no-store',
  });
}

export async function serverApiJson<T>(path: string): Promise<T> {
  const response = await serverApi(path);
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as T;
}
