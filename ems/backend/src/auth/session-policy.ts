/** Plan §5: 8 hours without activity, 7 days at most, last_seen_at written at most once a minute. */
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface SessionTimes {
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

export type SessionState = 'active' | 'revoked' | 'expired' | 'idle';

export function sessionState(session: SessionTimes, now: Date): SessionState {
  if (session.revokedAt) return 'revoked';
  if (session.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_IDLE_MS) return 'idle';
  return 'active';
}

export function shouldTouch(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS;
}

/** A new employee's set-password link lasts longer than a reset link: they may not be at work yet. */
export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
