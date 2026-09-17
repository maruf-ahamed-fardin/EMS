import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

export interface RequestContext {
  requestId: string;
  ip: string | undefined;
  userAgent: string | undefined;
  /** Set by the session guard once authentication exists (Phase 2). */
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** The current request's context, or undefined outside a request (jobs, bootstrap). */
export function currentRequest(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

// A caller-supplied id is reused so a trace can cross the Next.js proxy, but only when it looks
// like an id: it goes into logs and response headers.
const ACCEPTABLE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && ACCEPTABLE_REQUEST_ID.test(candidate) ? candidate : uuidv7();
}

/**
 * First middleware on every request: assigns the request id (pino-http reuses `req.id`), echoes it
 * back, marks API responses as uncacheable and opens the AsyncLocalStorage context that the logger,
 * error filter and (later) audit log read.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req.headers['x-request-id']);
  (req as Request & { id: string }).id = requestId;
  res.setHeader('x-request-id', requestId);
  // Everything behind the API is per-user or operational. Routes that are safe to cache opt in.
  res.setHeader('cache-control', 'private, no-store');

  runWithContext({ requestId, ip: req.ip, userAgent: req.get('user-agent') }, next);
}
