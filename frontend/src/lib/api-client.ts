import { CSRF_COOKIE, CSRF_HEADER } from '@ems/contracts';
import { readApiError } from './api-error';

const API_BASE = '/api/v1';

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

async function csrfToken(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin' });
  if (!response.ok) throw await readApiError(response);
  return readCookie(CSRF_COOKIE) ?? ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}

/**
 * The session has ended (expired, revoked, or signed out in another tab): go to sign-in and come back
 * here afterwards. A full navigation, so nothing cached for this user survives. Sign-in answers 401 for
 * a wrong password, which the form shows; signing out handles an ended session itself, and must not
 * send the next person back to this page.
 */
function onUnauthorized(path: string): void {
  if (path === '/auth/login' || path === '/auth/logout' || typeof window === 'undefined') return;
  const here = `${window.location.pathname}${window.location.search}`;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose: it drops every cached query of the ended session
  window.location.assign(`/login?next=${encodeURIComponent(here)}`);
}

/**
 * Browser-side API calls through the same-origin /api proxy. Sends the CSRF token on writes, and throws
 * ApiRequestError with the API's message and field errors on failure.
 */
export async function api<T = void>(path: string, init: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers[CSRF_HEADER] = await csrfToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (response.status === 401) onUnauthorized(path);
  if (!response.ok) throw await readApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * A multipart upload through the same proxy, with the CSRF token. The browser sets the multipart
 * boundary itself, so no content-type is given here.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', [CSRF_HEADER]: await csrfToken() },
    credentials: 'same-origin',
    body: form,
  });
  if (response.status === 401) onUnauthorized(path);
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as T;
}
