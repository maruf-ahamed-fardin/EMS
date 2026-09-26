import type { NextConfig } from 'next';

/**
 * Where /api/* is forwarded. The browser only ever talks to this app's origin, so the session
 * cookie stays first-party and the API needs no CORS (plan §2).
 * A missing API_ORIGIN warns rather than fails, so a Vercel build succeeds before the API is up;
 * set it and redeploy, since rewrites are baked in at build time.
 */
function apiOrigin(): string {
  const value = process.env.API_ORIGIN;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('API_ORIGIN is not set: /api/* goes to http://127.0.0.1:4000 and sign-in will not work');
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
  // camera=(self): Team Profile scans QR codes on this origin only; no embedded frame may use it
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Browsers only honour this over https; two years, the length preload lists expect.
  // The Content-Security-Policy is per request, with a nonce, in src/proxy.ts
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
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
