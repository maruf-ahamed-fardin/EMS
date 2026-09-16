import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { logger, type Logger } from './logger';

/** Throw from a handler to answer with that status as problem+json. */
export class HttpError extends Error {
  constructor(readonly status: number, readonly title: string, readonly detail?: string) {
    super(detail ?? title);
  }
}

/** RFC 9457 problem details response. `extra` is merged into the body, `headers` into the response. */
export function problem(
  status: number,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return Response.json(
    { type: 'about:blank', title, status, ...(detail && { detail }), ...extra },
    { status, headers: { ...headers, 'Content-Type': 'application/problem+json' } },
  );
}

export interface HandlerContext<P> {
  params: P;
  requestId: string;
  log: Logger;
}

type Params = Record<string, string | string[]>;

/**
 * Wraps a Route Handler: attaches the request id (set by the proxy) and a logger bound to it,
 * turns thrown errors into problem+json, and defaults to `Cache-Control: private, no-store`
 * so a response is only cacheable when its route says so.
 */
export function route<P extends Params = Params>(
  handler: (request: NextRequest, context: HandlerContext<P>) => Response | Promise<Response>,
) {
  return async (request: NextRequest, { params }: { params: Promise<P> }): Promise<Response> => {
    const requestId = request.headers.get('x-request-id') ?? randomUUID();
    const log = logger.child({ requestId });

    let response: Response;
    try {
      response = await handler(request, { params: await params, requestId, log });
    } catch (error) {
      response = errorResponse(error, log);
    }

    if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Request-Id', requestId);
    return response;
  };
}

function errorResponse(error: unknown, log: Logger): Response {
  if (error instanceof HttpError) return problem(error.status, error.title, error.detail);
  if (error instanceof z.ZodError) {
    const errors = error.issues.map(issue => ({ path: issue.path.map(String).join('.'), message: issue.message }));
    return problem(400, 'Invalid request', undefined, { errors });
  }
  log.error({ err: error }, 'Unhandled error in route handler');
  return problem(500, 'Internal Server Error');
}

/** Validates query parameters; a failure becomes a 400. */
export function readQuery<T extends z.ZodType>(request: NextRequest, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

/** Validates a JSON body; malformed JSON or a failed check becomes a 400. */
export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Invalid request', 'Body must be valid JSON');
  }
  return schema.parse(body);
}
