import { z } from 'zod';
import { problem, readQuery, route } from '@/server/lib/http';
import { RateLimiter, clientAddress, rateLimitHeaders } from '@/server/lib/rate-limit';
import { findTeamMember } from '@/lib/team';

// JSON endpoint, same contract as the pre-Next.js /api/team-profile?id=<username|employeeId>.
// The pages read the database directly; this stays for any external consumers.

const LIMIT = 60;
const WINDOW_MS = 60_000;
// Profiles are public, so the limit only needs to make walking the employee-ID range slow
const limiter = new RateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });

const query = z.object({
  id: z.string().min(1, 'id parameter required').max(128),
});

export const GET = route(async (request, { log }) => {
  const budget = limiter.consume(clientAddress(request));
  const headers = rateLimitHeaders(budget, LIMIT);
  if (!budget.allowed) {
    return problem(429, 'Too Many Requests', 'Slow down and try again shortly', undefined, {
      ...headers,
      'Retry-After': headers['RateLimit-Reset'],
    });
  }

  const { id } = readQuery(request, query);
  const member = await findTeamMember(id);

  if (!member) {
    return Response.json({ found: false }, {
      status: 404,
      headers: { ...headers, 'Cache-Control': 'public, s-maxage=60' },
    });
  }

  log.debug({ username: member.user.username }, 'Served team profile');

  // CDN: 30s cache, 60s stale-while-revalidate (keeps data fresh after updates)
  return Response.json({ found: true, ...member }, {
    headers: { ...headers, 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
});
