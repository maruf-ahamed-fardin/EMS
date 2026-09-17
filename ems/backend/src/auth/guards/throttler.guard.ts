import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Counts per signed-in session, or per IP before sign-in. Requests that carry an email (login, forgot
 * password) count per IP *and* email, so one address can't be hammered and one office's shared IP
 * doesn't lock everyone out. Limits per route are set with @Throttle().
 */
export function throttleTracker(req: Pick<Request, 'ip' | 'auth' | 'body'>): string {
  const body = req.body as { email?: unknown } | undefined;
  if (typeof body?.email === 'string' && body.email.trim()) {
    return `ip:${req.ip}|email:${body.email.trim().toLowerCase().slice(0, 254)}`;
  }
  if (req.auth) return `session:${req.auth.sessionId}`;
  return `ip:${req.ip}`;
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(throttleTracker(req as unknown as Request));
  }
}
