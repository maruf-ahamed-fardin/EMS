'use server';

import { type LoginInput, loginInput, SESSION_COOKIE } from '@ems/contracts';
import { cookies } from 'next/headers';
import { checkLocalLogin, localLoginEnabled, newLocalSession } from './local-auth';

/** Sign-in against LOGIN_EMAIL / LOGIN_PASSWORD (lib/local-auth.ts). Returns an error message, or null. */
export async function localSignIn(values: LoginInput): Promise<string | null> {
  if (!localLoginEnabled()) return 'Sign-in is not set up on this server.';
  const parsed = loginInput.safeParse(values);
  if (!parsed.success || !checkLocalLogin(parsed.data.email, parsed.data.password)) {
    // Same pause as a real login check, so guessing is slow
    await new Promise((resolve) => setTimeout(resolve, 400));
    return 'Email or password is incorrect.';
  }
  const session = newLocalSession();
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAge,
  });
  return null;
}

/** Drops the session cookie. Harmless with the API as well, which has already ended its session. */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
