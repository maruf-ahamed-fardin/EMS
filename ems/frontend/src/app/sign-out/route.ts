import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth-paths';

/**
 * Clears the session cookie. Phase 2 also calls POST /api/v1/auth/logout first, so the server-side
 * session is revoked rather than just forgotten by this browser.
 */
export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
