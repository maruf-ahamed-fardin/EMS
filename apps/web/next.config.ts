import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The API (server/, package @ems/backend) runs inside this app. Its own compiled code is bundled with
 * the /api route, but every package it depends on is loaded with Node's require, as when it ran on its
 * own: some read their own files at run time (pdfkit's fonts, pino's workers, Prisma's query compiler)
 * and Nest imports optional packages inside try/catch, which only works unbundled.
 */
const backend = JSON.parse(readFileSync(path.join(__dirname, 'server/package.json'), 'utf8')) as { dependencies: Record<string, string> };
const apiPackages = [
  // rxjs stays bundled: Next already optimises its imports, and it reads no files of its own
  ...Object.keys(backend.dependencies).filter((name) => !name.startsWith('@ems/') && name !== 'rxjs'),
  // Optional Nest packages this app doesn't install; Nest skips them when require fails
  '@nestjs/microservices',
  '@nestjs/websockets',
  'class-transformer',
  'class-validator',
];

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
  serverExternalPackages: apiPackages,
  // Trace from the repository root, so the build output includes the packages the API loads at run time
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: { root: path.join(__dirname, '../..') },
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  async headers() {
    // Pages only: the API sets its own security headers (helmet), as it did as a separate server
    return [{ source: '/((?!api/).*)', headers: securityHeaders }];
  },
};

export default nextConfig;
