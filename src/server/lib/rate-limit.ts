/**
 * Fixed-window rate limiting, held in memory.
 *
 * Each serverless instance keeps its own counters, so the real limit across a deployment is
 * roughly `limit x instances`. That is enough to stop someone walking the whole employee-ID
 * range from one machine, which is what this guards against; it is not a billing-grade quota.
 * Swap the store for Redis if that is ever needed - callers only use `consume`.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix milliseconds when the current window ends */
  resetAt: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** Counters held at once. Oldest windows are dropped first, so a flood of one-off IPs can't grow the map forever. */
  maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 10_000;

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly options: RateLimitOptions) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    const { limit, windowMs, maxKeys = DEFAULT_MAX_KEYS } = this.options;

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
    }
    window.count += 1;

    // Re-inserting keeps the Map in least-recently-used order for the eviction below
    this.windows.delete(key);
    this.windows.set(key, window);
    if (this.windows.size > maxKeys) this.prune(now, maxKeys);

    return {
      allowed: window.count <= limit,
      remaining: Math.max(0, limit - window.count),
      resetAt: window.resetAt,
    };
  }

  private prune(now: number, maxKeys: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    // Still over budget: drop the least recently seen keys
    for (const key of this.windows.keys()) {
      if (this.windows.size <= maxKeys) break;
      this.windows.delete(key);
    }
  }
}

/**
 * Best-effort client address. `x-forwarded-for` is set by the platform edge (Vercel) and cannot be
 * overridden by the caller there; behind a different proxy, make sure it rewrites the header too.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Headers describing the caller's remaining budget, for both allowed and rejected responses. */
export function rateLimitHeaders(result: RateLimitResult, limit: number): Record<string, string> {
  return {
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}
