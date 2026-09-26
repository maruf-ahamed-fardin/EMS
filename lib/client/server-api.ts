import 'server-only';
import { cookies, headers } from 'next/headers';
import { apiOrigin } from '@/lib/server/nest';
import { ApiUnreachableError, readApiError } from './api-error';

/**
 * Server-side API calls for server components (plan §2): the visitor's cookies are forwarded, so the
 * API applies their session and permissions exactly as for a browser call.
 */
export async function serverApi(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const requestId = (await headers()).get('x-request-id');

  const origin = await apiOrigin();
  try {
    return await fetch(`${origin}/api/v1${path}`, {
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
      },
      cache: 'no-store',
    });
  } catch (cause) {
    // fetch rejects with a bare "TypeError: fetch failed" when nothing is listening, which says
    // nothing about which address failed or why.
    throw new ApiUnreachableError(origin, cause);
  }
}

export async function serverApiJson<T>(path: string): Promise<T> {
  const response = await serverApi(path);
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as T;
}
