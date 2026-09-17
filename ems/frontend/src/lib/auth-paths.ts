export { SESSION_COOKIE } from '@ems/contracts';

/** Remembers the collapsed sidebar, read on the server so the first paint has the right width. */
export const SIDEBAR_COOKIE = 'ems_sidebar';

export const HOME_PATH = '/dashboard';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Where to go after signing in. Only same-site paths are accepted, so `?next=` can't send someone
 * to another site (`//evil.example`, `/\evil.example` and absolute URLs all fall back to home).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return HOME_PATH;
  try {
    const url = new URL(next, 'http://local.invalid');
    if (url.origin !== 'http://local.invalid' || isPublicPath(url.pathname)) return HOME_PATH;
    return `${url.pathname}${url.search}`;
  } catch {
    return HOME_PATH;
  }
}
