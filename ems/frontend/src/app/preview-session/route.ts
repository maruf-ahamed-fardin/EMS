import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, safeNextPath } from '@/lib/auth-paths';
import { isSystemRoleKey, PREVIEW_ENABLED, previewToken } from '@/lib/preview-session';

/** Development only: starts a preview session as a default role. Removed in Phase 2. */
export function GET(request: NextRequest) {
  if (!PREVIEW_ENABLED) return new NextResponse(null, { status: 404 });

  const role = request.nextUrl.searchParams.get('role');
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, previewToken(isSystemRoleKey(role) ? role : 'super_admin'), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  return response;
}
