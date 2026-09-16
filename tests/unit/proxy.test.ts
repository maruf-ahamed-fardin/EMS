import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** proxy.ts reads ALLOWED_ORIGINS and NODE_ENV when the module loads. */
async function loadProxy(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return (await import('@/proxy')).proxy;
}

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const request = (path: string, init: NextRequestInit = {}) =>
  new NextRequest(`https://team.selorax.io${path}`, init);

beforeEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('adds the security headers to API responses', async () => {
    const proxy = await loadProxy();
    const response = proxy(request('/api/team-profile?id=nadia'));

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it('sends HSTS only in production', async () => {
    const dev = await loadProxy({ NODE_ENV: 'development' });
    expect(dev(request('/api/health')).headers.get('Strict-Transport-Security')).toBeNull();

    const prod = await loadProxy({ NODE_ENV: 'production' });
    expect(prod(request('/api/health')).headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
  });

  it('generates a request id and echoes it back', async () => {
    const proxy = await loadProxy();
    const id = proxy(request('/api/health')).headers.get('X-Request-Id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a caller request id that looks like one', async () => {
    const proxy = await loadProxy();
    const response = proxy(request('/api/health', { headers: { 'x-request-id': 'edge-abc12345' } }));
    expect(response.headers.get('X-Request-Id')).toBe('edge-abc12345');
  });

  // Control characters never get this far: the Headers implementation rejects them outright.
  it('replaces a request id that is the wrong shape', async () => {
    const proxy = await loadProxy();
    for (const bad of ['short', 'has spaces here', '<script>alert(1)</script>', 'x'.repeat(129)]) {
      const response = proxy(request('/api/health', { headers: { 'x-request-id': bad } }));
      expect(response.headers.get('X-Request-Id')).not.toBe(bad);
    }
  });

  it('rejects a write from an origin that is not allowed', async () => {
    const proxy = await loadProxy({ ALLOWED_ORIGINS: 'https://team.selorax.io' });
    const response = proxy(request('/api/v1/me', { method: 'POST', headers: { origin: 'https://evil.example' } }));

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
  });

  it('allows a write from a configured origin', async () => {
    const proxy = await loadProxy({ ALLOWED_ORIGINS: 'https://team.selorax.io, http://localhost:3000' });
    for (const origin of ['https://team.selorax.io', 'http://localhost:3000']) {
      const response = proxy(request('/api/v1/me', { method: 'POST', headers: { origin } }));
      expect(response.status).toBe(200);
    }
  });

  it('never blocks a read, whatever the origin', async () => {
    const proxy = await loadProxy({ ALLOWED_ORIGINS: 'https://team.selorax.io' });
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const response = proxy(request('/api/team-profile?id=nadia', { method, headers: { origin: 'https://evil.example' } }));
      expect(response.status).toBe(200);
    }
  });

  it('lets through a write with no Origin header, which browsers always send', async () => {
    const proxy = await loadProxy({ ALLOWED_ORIGINS: 'https://team.selorax.io' });
    expect(proxy(request('/api/v1/sync', { method: 'POST' })).status).toBe(200);
  });
});

describe('proxy matcher', () => {
  it('covers the API but not the pages, whose CSP would break', async () => {
    vi.resetModules();
    const { config } = await import('@/proxy');
    const [pattern] = config.matcher;
    const matches = (path: string) => new RegExp(`^${pattern}$`).test(path);

    expect(matches('/api/team-profile')).toBe(true);
    expect(matches('/api/health')).toBe(true);
    expect(matches('/nadia')).toBe(false);
    // Avatar uploads do their own origin check: the proxy truncates large bodies
    expect(matches('/api/v1/me/avatar')).toBe(false);
  });
});
