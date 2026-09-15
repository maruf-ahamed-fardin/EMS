import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (its Dockerfile sets this);
  // `next start` and Vercel want the normal output
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
};

export default nextConfig;
