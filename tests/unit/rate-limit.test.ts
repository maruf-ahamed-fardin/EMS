import { describe, expect, it } from 'vitest';
import { RateLimiter, clientAddress, rateLimitHeaders } from '@/server/lib/rate-limit';

describe('RateLimiter', () => {
  it('allows up to the limit, then refuses', () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 1000 });
    const results = [1, 2, 3, 4].map(() => limiter.consume('1.2.3.4', 0));

    expect(results.map(r => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map(r => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it('counts each caller separately', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.consume('1.1.1.1', 0).allowed).toBe(true);
    expect(limiter.consume('2.2.2.2', 0).allowed).toBe(true);
    expect(limiter.consume('1.1.1.1', 0).allowed).toBe(false);
  });

  it('starts a fresh window once the old one ends', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.consume('1.1.1.1', 0).allowed).toBe(true);
    expect(limiter.consume('1.1.1.1', 999).allowed).toBe(false);
    expect(limiter.consume('1.1.1.1', 1000).allowed).toBe(true);
  });

  it('reports when the window ends', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.consume('1.1.1.1', 5_000).resetAt).toBe(65_000);
  });

  it('keeps memory bounded when many one-off callers arrive', () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: 1000, maxKeys: 10 });
    for (let i = 0; i < 500; i++) limiter.consume(`10.0.0.${i}`, 0);

    // The most recent caller is still counted, so the limit still works for them
    expect(limiter.consume('10.0.0.499', 0).remaining).toBe(3);
    expect(Reflect.get(limiter, 'windows').size).toBeLessThanOrEqual(11);
  });

  it('drops expired windows before evicting live ones', () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: 1000, maxKeys: 2 });
    limiter.consume('old', 0);
    limiter.consume('a', 2000);
    limiter.consume('b', 2000);
    limiter.consume('c', 2000);

    const windows: Map<string, unknown> = Reflect.get(limiter, 'windows');
    expect(windows.has('old')).toBe(false);
    expect(windows.has('c')).toBe(true);
  });
});

describe('clientAddress', () => {
  const req = (headers: Record<string, string>) => new Request('https://team.selorax.io/api/team-profile', { headers });

  it('takes the first entry of x-forwarded-for', () => {
    expect(clientAddress(req({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then to a constant', () => {
    expect(clientAddress(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientAddress(req({}))).toBe('unknown');
  });

  it('ignores an empty x-forwarded-for', () => {
    expect(clientAddress(req({ 'x-forwarded-for': '  ', 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });
});

describe('rateLimitHeaders', () => {
  it('reports the limit, what is left and seconds to reset', () => {
    const headers = rateLimitHeaders({ allowed: true, remaining: 4, resetAt: Date.now() + 30_000 }, 60);
    expect(headers['RateLimit-Limit']).toBe('60');
    expect(headers['RateLimit-Remaining']).toBe('4');
    expect(Number(headers['RateLimit-Reset'])).toBeGreaterThan(25);
  });

  it('never reports a negative reset for a window that already passed', () => {
    const headers = rateLimitHeaders({ allowed: true, remaining: 0, resetAt: Date.now() - 5_000 }, 60);
    expect(headers['RateLimit-Reset']).toBe('0');
  });
});
