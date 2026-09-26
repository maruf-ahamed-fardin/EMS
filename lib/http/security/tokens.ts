import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes as base64url (43 characters): session, reset and CSRF tokens. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * What the database stores for a token. A leaked table can't be replayed, and because the tokens are
 * high-entropy random values, a fast hash is enough (no salt or stretching needed).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time string comparison that tolerates different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right) && a.length === b.length;
}
