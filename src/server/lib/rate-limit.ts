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
 * The caller's address, or null when nothing identifies them.
 *
 * `x-forwarded-for` is set by the platform edge (Vercel) and cannot be overridden by the caller
 * there; behind a different proxy, make sure it rewrites the header too. Node itself does not
 * expose the socket address to a Route Handler, so a server reached directly - `next start` with
 * no proxy in front, which is what the Docker image runs - has nothing to key on. Returning null
 * lets callers skip limiting rather than drop every visitor into one shared bucket, which would
 * turn a busy minute into a site-wide 429.
 */
export function clientAddress(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || null;
}

/**
 * Headers describing the caller's remaining budget.
 *
 * Only ever put these on a response that is not publicly cacheable: they describe one caller, so a
 * shared cache would hand one visitor's budget to everyone who follows.
 */
export function rateLimitHeaders(result: RateLimitResult, limit: number, now = Date.now()): Record<string, string> {
  return {
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - now) / 1000))),
  };
}
