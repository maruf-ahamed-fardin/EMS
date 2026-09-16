import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// Rendered per request rather than baked in at build time, so one image deployed to staging and
// production reports the host it is actually running on.
export const dynamic = 'force-dynamic';

// Profile pages are public and meant to be findable. The API is not: it serves the same
// data as JSON, so letting crawlers walk it only costs database reads.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  };
}
