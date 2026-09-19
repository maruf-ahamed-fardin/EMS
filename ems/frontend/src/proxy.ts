import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath, SESSION_COOKIE } from '@/lib/auth-paths';
import { contentSecurityPolicy, newNonce } from '@/lib/csp';

/**
 * Every page: a fresh CSP nonce, which Next reads from the request header and puts on its scripts.
 * Visitors without a session cookie go to the login page. That redirect is a fast path for a nicer
 * experience, not security: the (app) layout checks the session on the server, and the API checks
 * every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === 'development' });

  let response: NextResponse;
  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE)) {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    response = NextResponse.next({ request: { headers } });
  } else {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(login);
  }
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Pages only. /api is rewritten to the backend, which answers 401 itself.
  matcher: ['/((?!api/|_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)'],
};
