import type { NextConfig } from 'next';

/**
 * Where /api/* is forwarded. The browser only ever talks to this app's origin, so the session
 * cookie stays first-party and the API needs no CORS (plan §2).
 */
function apiOrigin(): string {
  const value = process.env.API_ORIGIN;
  if (!value) {
    if (process.env.NODE_ENV === 'production' && process.env.CI !== 'true') {
      throw new Error('API_ORIGIN is required for a production build (for example http://api:4000)');
    }
    return 'http://127.0.0.1:4000';
  }
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('API_ORIGIN must be an http(s) URL');
  return url.origin;
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // The full Content-Security-Policy and HSTS are added in Phase 12 (hardening)
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Next buffers request bodies up to this size and cuts off the rest. Document uploads are up to
    // 10 MB plus multipart overhead; the API itself answers 413 for anything larger.
    proxyClientMaxBodySize: '11mb',
  },
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin()}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
