import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath, SESSION_COOKIE } from '@/lib/auth-paths';

/**
 * Sends visitors without a session cookie to the login page. This is a fast path for a nicer
 * redirect, not security: the (app) layout checks the session on the server, and the API checks
 * every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Pages only. /api is rewritten to the backend, which answers 401 itself.
  matcher: ['/((?!api/|_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)'],
};
