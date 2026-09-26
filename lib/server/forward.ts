import type { NextRequest } from 'next/server';
import { apiOrigin } from './nest';

// Hop-by-hop headers belong to one connection, not to the request being forwarded
const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length'];

/**
 * Sends a request to the in-process API (lib/server/nest.ts) unchanged. Every route file under
 * app/api/v1 exports it for the methods its NestJS controller handles (scripts/api-routes.mjs).
 */
export async function forward(request: NextRequest): Promise<Response> {
  let origin: string;
  try {
    origin = await apiOrigin();
  } catch {
    // The reason (usually a missing or invalid environment variable) is in the server log
    return Response.json({ statusCode: 503, message: 'The service is not available right now' }, { status: 503 });
  }
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, origin);

  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  // The API trusts one proxy hop (TRUST_PROXY_HOPS): this handler. Vercel sets x-forwarded-for to
  // the visitor's address; locally there is none, so the request came from this machine.
  if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', '127.0.0.1');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // Required by Node's fetch to stream a request body
    ...(hasBody ? { duplex: 'half' } : {}),
    redirect: 'manual',
    cache: 'no-store',
  } as RequestInit);

  const out = new Headers(response.headers);
  for (const name of HOP_BY_HOP) out.delete(name);
  // fetch has already decoded a compressed body
  out.delete('content-encoding');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: out });
}

