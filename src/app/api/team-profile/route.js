import { findTeamMember } from '@/lib/team';

// JSON endpoint, same contract as the pre-Next.js /api/team-profile?id=<username|employeeId>.
// The pages read the database directly; this stays for any external consumers.
export async function GET(request) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id parameter required' }, { status: 400 });

  try {
    const member = await findTeamMember(id);
    if (!member) {
      return Response.json({ found: false }, {
        status: 404,
        headers: { 'Cache-Control': 'public, s-maxage=60' },
      });
    }

    // CDN: 30s cache, 60s stale-while-revalidate (keeps data fresh after updates)
    return Response.json({ found: true, ...member }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
