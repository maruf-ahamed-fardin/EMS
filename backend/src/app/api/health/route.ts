import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { problem, route } from '@/server/lib/http';

// For load balancers and uptime checks: answers 200 only if the database responds
export const GET = route(async (_request, { log }) => {
  try {
    await getDb().execute(sql`SELECT 1`);
  } catch (error) {
    log.error({ err: error }, 'Health check failed: database unreachable');
    return problem(503, 'Service Unavailable', 'Database unreachable');
  }
  return Response.json({ status: 'ok' });
});
