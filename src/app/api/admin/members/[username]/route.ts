import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/admin-auth';
import { updateTeamMember, deleteTeamMember } from '@/lib/team';

interface RouteContext {
  params: Promise<{ username: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const isAuth = await isAuthenticatedAdmin();
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;
    const body = await req.json();
    const { user, profilePic, profileData } = body;

    await updateTeamMember(decodeURIComponent(username), {
      user: user || {},
      profilePic,
      profileData,
    });

    return NextResponse.json({ success: true, message: 'Member updated successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update member';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const isAuth = await isAuthenticatedAdmin();
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;
    await deleteTeamMember(decodeURIComponent(username));
    return NextResponse.json({ success: true, message: 'Member deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete member';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
