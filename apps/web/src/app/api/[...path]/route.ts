import { embeddedApi } from '@/lib/embedded-api';

/**
 * Every /api/* request goes to the API running inside this process (apps/web/server), unchanged:
 * method, path, query, headers (cookies, CSRF token, Origin, X-Forwarded-For) and a streamed body.
 * The API answers exactly as it did as a separate server, so authentication, permissions, validation,
 * rate limits, audit and error formats all stay in one place: the API.
 */

// Hop-by-hop headers belong to one connection and are never forwarded (RFC 9110 §7.6.1)
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

async function forward(request: Request): Promise<Response> {
  let origin: string;
  try {
    ({ origin } = await embeddedApi());
  } catch (error) {
    console.error('The API did not start:', error instanceof Error ? error.message : error);
    return Response.json({ statusCode: 503, message: 'The service is starting or unavailable. Try again shortly.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const name of [...HOP_BY_HOP, 'host']) headers.delete(name);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', ''));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(`${origin}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // Required by Node's fetch to send a streamed request body
    ...(hasBody ? { duplex: 'half' } : {}),
    redirect: 'manual',
    signal: request.signal,
    cache: 'no-store',
  } as RequestInit);

  const responseHeaders = new Headers(upstream.headers);
  for (const name of HOP_BY_HOP) responseHeaders.delete(name);
  // fetch has already decoded a compressed body, so its encoding and length no longer apply
  if (responseHeaders.has('content-encoding')) {
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export { forward as GET, forward as HEAD, forward as POST, forward as PUT, forward as PATCH, forward as DELETE, forward as OPTIONS };
