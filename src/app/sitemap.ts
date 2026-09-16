import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// Rendered per request rather than baked in at build time, so one image deployed to staging and
// production reports the host it is actually running on.
export const dynamic = 'force-dynamic';

// Only the entry point. Listing every member here would publish the whole staff directory
// in one file, which is a decision for the team rather than a side effect of adding a sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl(), changeFrequency: 'weekly', priority: 1 }];
}
