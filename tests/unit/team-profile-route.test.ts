import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findTeamMember = vi.fn();
vi.mock('@/lib/team', () => ({ findTeamMember }));

const MEMBER = {
  redirectTo: null,
  user: { username: 'nadia', name: 'Nadia Islam', employeeId: 'SX-002' },
  profilePic: null,
  profileData: { email: 'nadia@selorax.io' },
};

/** The limiter counts per module instance, so each test gets a fresh one. */
async function loadRoute() {
  vi.resetModules();
  return (await import('@/app/api/team-profile/route')).GET;
}

const call = (GET: Awaited<ReturnType<typeof loadRoute>>, query: string, ip = '203.0.113.1') =>
  GET(
    new NextRequest(`https://team.selorax.io/api/team-profile${query}`, { headers: { 'x-forwarded-for': ip } }),
    { params: Promise.resolve({}) },
  );

beforeEach(() => {
  findTeamMember.mockReset();
  findTeamMember.mockResolvedValue(MEMBER);
});

describe('GET /api/team-profile', () => {
  it('returns the member with found: true', async () => {
    const response = await call(await loadRoute(), '?id=nadia');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ found: true, ...MEMBER });
  });

  it('lets the CDN cache a hit briefly', async () => {
    const response = await call(await loadRoute(), '?id=nadia');
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=60');
  });

  it('answers 404 with found: false for an unknown member', async () => {
    findTeamMember.mockResolvedValue(null);
    const response = await call(await loadRoute(), '?id=nobody');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ found: false });
  });

  it('rejects a missing or oversized id', async () => {
    const GET = await loadRoute();
    expect((await call(GET, '')).status).toBe(400);
    expect((await call(GET, `?id=${'x'.repeat(129)}`)).status).toBe(400);
    expect(findTeamMember).not.toHaveBeenCalled();
  });

  it('hides a database failure behind a 500 that leaks nothing', async () => {
    findTeamMember.mockRejectedValue(new Error('connect ECONNREFUSED mysql://reader:s3cret@hr-db'));
    const response = await call(await loadRoute(), '?id=nadia');

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('s3cret');
  });

  it('refuses a caller that walks the employee-ID range', async () => {
    const GET = await loadRoute();
    let blocked: Response | undefined;
    for (let i = 0; i < 61; i++) {
      const response = await call(GET, `?id=SX-${String(i).padStart(3, '0')}`);
      if (response.status === 429) { blocked = response; break; }
    }

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
    expect(blocked?.headers.get('Content-Type')).toBe('application/problem+json');
  });

  it('counts each caller separately', async () => {
    const GET = await loadRoute();
    for (let i = 0; i < 61; i++) await call(GET, `?id=SX-${i}`, '203.0.113.1');

    const other = await call(GET, '?id=nadia', '198.51.100.7');
    expect(other.status).toBe(200);
  });

  it('keeps per-caller budget headers off responses the CDN shares', async () => {
    const GET = await loadRoute();
    const hit = await call(GET, '?id=nadia');
    findTeamMember.mockResolvedValue(null);
    const miss = await call(GET, '?id=nobody');

    for (const response of [hit, miss]) {
      expect(response.headers.get('Cache-Control')).toMatch(/^public,/);
      expect(response.headers.get('RateLimit-Limit')).toBeNull();
      expect(response.headers.get('RateLimit-Remaining')).toBeNull();
    }
  });

  it('reports the budget on the 429, which is never cached', async () => {
    const GET = await loadRoute();
    let blocked: Response | undefined;
    for (let i = 0; i < 61 && !blocked; i++) {
      const response = await call(GET, `?id=SX-${i}`);
      if (response.status === 429) blocked = response;
    }
    expect(blocked?.headers.get('RateLimit-Limit')).toBe('60');
    expect(blocked?.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('serves everyone instead of sharing one bucket when no address is available', async () => {
    const GET = await loadRoute();
    // `next start` with no proxy sends no x-forwarded-for; one shared bucket would 429 the whole site
    for (let i = 0; i < 200; i++) {
      const response = await GET(
        new NextRequest(`https://team.selorax.io/api/team-profile?id=SX-${i}`),
        { params: Promise.resolve({}) },
      );
      expect(response.status).toBe(200);
    }
  });
});
