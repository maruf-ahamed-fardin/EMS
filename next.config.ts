import type { NextConfig } from 'next';
import { siteUrl } from './src/lib/site';

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (its Dockerfile sets this);
  // `next start` and Vercel want the normal output
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  env: {
    // The public URL as it was resolved when this build ran, inlined into the bundle. Statically
    // rendered pages bake their absolute URLs in from the same value, so the server can compare it
    // with its own configuration at startup and report a build that was made for a different host.
    BUILD_SITE_URL: siteUrl(),
  },
};

export default nextConfig;
