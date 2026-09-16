const FALLBACK = 'http://localhost:3000';

/**
 * Absolute base URL for canonical links, sitemaps and social preview images.
 *
 * Read straight from the environment rather than through getEnv(), because `next build` imports
 * this while generating static pages, before runtime configuration exists. A wrong value only
 * makes preview links point at the wrong host, so a fallback is safe here.
 */
export function siteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  // Set by Vercel on every deployment, so previews get their own correct URL
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : FALLBACK;
}
