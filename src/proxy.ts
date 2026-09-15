import { NextResponse, type NextRequest } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Accept a caller's request id (e.g. from the frontend or a load balancer) only if it looks like one
const REQUEST_ID = /^[\w.-]{8,128}$/;

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean),
);

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  }),
};

export function proxy(request: NextRequest) {
  const incomingId = request.headers.get('x-request-id');
  const requestId = incomingId && REQUEST_ID.test(incomingId) ? incomingId : crypto.randomUUID();

  let response: NextResponse;
  const origin = request.headers.get('origin');
  // Browsers always send Origin on cross-site writes; requests without one (cron, scripts) rely on route auth
  if (!SAFE_METHODS.has(request.method) && origin && !allowedOrigins.has(origin)) {
    response = NextResponse.json(
      { type: 'about:blank', title: 'Forbidden', status: 403, detail: 'Origin not allowed' },
      { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
    );
  } else {
    const headers = new Headers(request.headers);
    headers.set('x-request-id', requestId);
    response = NextResponse.next({ request: { headers } });
  }

  response.headers.set('X-Request-Id', requestId);
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  return response;
}

export const config = {
  // Upload routes skip the proxy: it buffers request bodies and silently truncates them past 10MB.
  // Those handlers do their own origin check.
  matcher: ['/((?!api/v1/me/avatar).*)'],
};
