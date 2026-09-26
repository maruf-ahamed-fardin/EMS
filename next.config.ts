import type { NextConfig } from 'next';

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
  // The API (lib/server/nest.ts) loads these from node_modules at run time rather than through the
  // bundler: Nest resolves optional packages dynamically, and argon2 and Prisma ship native code.
  serverExternalPackages: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-express',
    '@nestjs/schedule',
    '@nestjs/throttler',
    'nestjs-pino',
    'nestjs-zod',
    'pino',
    'pino-http',
    'pino-pretty',
    'argon2',
    'pdfkit',
    'nodemailer',
    'pg',
    '@prisma/client',
    '@prisma/adapter-pg',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'express',
    'helmet',
    'cookie-parser',
  ],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
