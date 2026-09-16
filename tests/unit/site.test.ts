import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteUrl } from '@/lib/site';

afterEach(() => vi.unstubAllEnvs());

describe('siteUrl', () => {
  it('prefers SITE_URL', () => {
    vi.stubEnv('SITE_URL', 'https://team.selorax.io');
    expect(siteUrl()).toBe('https://team.selorax.io');
  });

  it('drops a trailing slash, so joined paths never double up', () => {
    vi.stubEnv('SITE_URL', 'https://team.selorax.io/');
    expect(new URL('/sitemap.xml', siteUrl()).toString()).toBe('https://team.selorax.io/sitemap.xml');
  });

  it('falls back to the Vercel production domain', () => {
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'team-selorax.vercel.app');
    expect(siteUrl()).toBe('https://team-selorax.vercel.app');
  });

  it('uses the per-deployment Vercel URL when there is no production domain', () => {
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', 'team-selorax-abc123.vercel.app');
    expect(siteUrl()).toBe('https://team-selorax-abc123.vercel.app');
  });

  it('falls back to localhost so `next build` never fails on a missing variable', () => {
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', '');
    expect(siteUrl()).toBe('http://localhost:3000');
    expect(() => new URL(siteUrl())).not.toThrow();
  });
});
