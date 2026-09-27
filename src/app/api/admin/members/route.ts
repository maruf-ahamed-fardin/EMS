import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAuthenticatedAdmin } from '@/lib/admin-auth';
import { getFullAdminMembers, createTeamMember } from '@/lib/team';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isAuth = await isAuthenticatedAdmin();
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const members = await getFullAdminMembers();
    return NextResponse.json(
      { members },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch members';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isAuth = await isAuthenticatedAdmin();
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { user, profilePic, profileData } = body;

    if (!user || !user.name || !user.username) {
      return NextResponse.json(
        { error: 'Name and Username are required' },
        { status: 400 }
      );
    }

    await createTeamMember({ user, profilePic, profileData });
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: true, message: 'Member created successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create member';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
