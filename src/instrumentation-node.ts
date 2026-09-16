// Loaded by instrumentation.ts on the Node.js runtime only.
// Refuses to start the server with a broken configuration instead of failing on the first request that needs it.
import { getEnv } from './server/env';
import { siteUrl } from './lib/site';

if (process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Statically rendered pages bake their absolute URLs in at build time, so the public URL has to
  // be known to `next build`, not just to the running server. BUILD_SITE_URL is that baked value.
  // A mismatch only breaks link previews and canonical URLs, which nothing else would report, so
  // this warns rather than refusing to start.
  const bakedSiteUrl = process.env.BUILD_SITE_URL;
  if (process.env.NODE_ENV === 'production' && bakedSiteUrl && bakedSiteUrl !== siteUrl()) {
    console.warn(
      `This build baked in ${bakedSiteUrl} as the public URL, but the server is configured for ${siteUrl()}. ` +
      'Link previews and canonical URLs will point at the baked value. Set SITE_URL before `next build` ' +
      '(the Dockerfile takes it as a build argument).',
    );
  }
}
