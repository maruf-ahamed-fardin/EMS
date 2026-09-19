import { applyDecorators, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const PER_ACCOUNT = 'ems:throttle-per-account';

/**
 * The `default` limit counts per signed-in session, or per IP before sign-in, and never looks at the
 * body: a key taken from the body would let a client pick its own bucket. Limits per route are set
 * with @Throttle().
 */
export function throttleTracker(req: Pick<Request, 'ip' | 'auth'>): string {
  if (req.auth) return `session:${req.auth.sessionId}`;
  return `ip:${req.ip}`;
}

/**
 * The `account` limit counts per IP *and* email, so one address can't be hammered while an office on a
 * shared IP keeps its own, larger per-IP allowance. Only routes marked @ThrottlePerAccount use it.
 */
export function accountTracker(req: Pick<Request, 'ip' | 'body'>): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  return `ip:${req.ip}|email:${email}`;
}

/** Adds the per-IP-and-email limit to a route that takes an email before sign-in (login, forgot password). */
export function ThrottlePerAccount(limit: number, ttl: number) {
  return applyDecorators(SetMetadata(PER_ACCOUNT, true), Throttle({ account: { limit, ttl } }));
}

export function skipAccountThrottle(context: ExecutionContext): boolean {
  return Reflect.getMetadata(PER_ACCOUNT, context.getHandler()) !== true;
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(throttleTracker(req as unknown as Request));
  }
}
