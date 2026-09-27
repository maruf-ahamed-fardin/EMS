import { NextRequest, NextResponse } from 'next/server';
import {
  getExpectedAdminPassword,
  isAuthenticatedAdmin,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from '@/lib/admin-auth';

export async function GET() {
  const authenticated = await isAuthenticatedAdmin();
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    const expected = getExpectedAdminPassword();
    if (!password || String(password).trim() !== expected) {
      return NextResponse.json(
        { error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    await setAdminSessionCookie();
    return NextResponse.json({ success: true, message: 'Authenticated successfully' });
  } catch {
    return NextResponse.json(
      { error: 'Internal authentication error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
