import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { type PermissionKey, type PermissionMap, PERMISSIONS } from '@/lib/validations';
import type { SessionUser } from './session';

/**
 * Sign-in without the API: one account, from LOGIN_EMAIL and LOGIN_PASSWORD, checked on this server.
 * Set both (Vercel's environment variables) and the login page uses it instead of the API; leave them
 * out and everything goes to the API as before. A stopgap until a real identity provider: there is
 * no sign-up, no password reset, and the session is a signed cookie rather than a server record.
 */

const SESSION_MS = 12 * 60 * 60 * 1000;

function credentials(): { email: string; password: string } | null {
  const email = process.env.LOGIN_EMAIL?.trim().toLowerCase();
  const password = process.env.LOGIN_PASSWORD;
  return email && password ? { email, password } : null;
}

export function localLoginEnabled(): boolean {
  return credentials() !== null;
}

/** Hashes both sides first, so the comparison takes the same time whatever their lengths. */
function sameText(a: string, b: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

// Keyed by the password, so changing LOGIN_PASSWORD signs everyone out
function sign(value: string, password: string): string {
  return createHmac('sha256', `ems-local-session:${password}`).update(value).digest('base64url');
}

export function checkLocalLogin(email: string, password: string): boolean {
  const account = credentials();
  if (!account) return false;
  // Both checks always run, so a wrong email and a wrong password take the same time
  const emailOk = sameText(email.trim().toLowerCase(), account.email);
  const passwordOk = sameText(password, account.password);
  return emailOk && passwordOk;
}

/** The cookie value: expiry and a signature over the email and expiry. */
export function newLocalSession(): { value: string; maxAge: number } {
  const account = credentials();
  if (!account) throw new Error('Local sign-in is not configured');
  const expires = Date.now() + SESSION_MS;
  return { value: `${expires}.${sign(`${account.email}|${expires}`, account.password)}`, maxAge: SESSION_MS / 1000 };
}

export function readLocalSession(cookie: string | undefined): SessionUser | null {
  const account = credentials();
  if (!account || !cookie) return null;
  const [expires, signature] = cookie.split('.');
  if (!expires || !signature || !(Number(expires) > Date.now())) return null;
  if (!sameText(signature, sign(`${account.email}|${expires}`, account.password))) return null;

  const permissions: PermissionMap = {};
  for (const key of Object.keys(PERMISSIONS) as PermissionKey[]) permissions[key] = 'ALL';
  return {
    id: 'local-admin',
    email: account.email,
    name: 'Administrator',
    role: { key: 'admin', name: 'Administrator' },
    employeeId: null,
    permissions,
  };
}
