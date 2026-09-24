import 'server-only';
import { cookies, headers } from 'next/headers';
import { ApiUnreachableError, readApiError } from './api-error';
import { embeddedApi } from './embedded-api';

/**
 * Server-side API calls for server components (plan §2): the visitor's cookies are forwarded, so the
 * API applies their session and permissions exactly as for a browser call.
 */
export async function serverApi(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const requestId = (await headers()).get('x-request-id');

  let origin = 'the API inside this app';
  try {
    ({ origin } = await embeddedApi());
    return await fetch(`${origin}/api/v1${path}`, {
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
      },
      cache: 'no-store',
    });
  } catch (cause) {
    // The API failed to start (most often a missing or invalid environment variable, named in the
    // server log), or fetch rejected with a bare "TypeError: fetch failed" that says nothing useful
    throw new ApiUnreachableError(origin, cause);
  }
}

export async function serverApiJson<T>(path: string): Promise<T> {
  const response = await serverApi(path);
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as T;
}
