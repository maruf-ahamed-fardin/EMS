import { contentSecurityPolicy, newNonce } from '@/lib/client/csp';

describe('content security policy', () => {
  it('runs only scripts with this response’s nonce, and blocks framing, plugins and foreign forms', () => {
    const csp = contentSecurityPolicy('abc123==', { dev: false, https: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc123==' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('allows what development needs, and nothing else extra', () => {
    const csp = contentSecurityPolicy('n', { dev: true, https: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('upgrades insecure requests only on https pages', () => {
    expect(contentSecurityPolicy('n', { dev: false, https: false })).not.toContain('upgrade-insecure-requests');
  });

  it('makes a different nonce every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    expect([...nonces][0]).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
