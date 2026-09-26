import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { checkLocalLogin, localLoginEnabled, newLocalSession, readLocalSession } = await import('@/lib/client/local-auth');

describe('local sign-in', () => {
  beforeEach(() => {
    vi.stubEnv('LOGIN_EMAIL', 'Admin@Example.test');
    vi.stubEnv('LOGIN_PASSWORD', 'correct horse battery');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('is off unless both variables are set', () => {
    expect(localLoginEnabled()).toBe(true);
    vi.stubEnv('LOGIN_PASSWORD', '');
    expect(localLoginEnabled()).toBe(false);
    expect(checkLocalLogin('admin@example.test', '')).toBe(false);
  });

  it('accepts the configured account only, with the email in any case', () => {
    expect(checkLocalLogin(' ADMIN@example.test ', 'correct horse battery')).toBe(true);
    expect(checkLocalLogin('admin@example.test', 'wrong')).toBe(false);
    expect(checkLocalLogin('someone@example.test', 'correct horse battery')).toBe(false);
  });

  it('reads back its own session as an administrator with every permission', () => {
    const user = readLocalSession(newLocalSession().value);
    expect(user?.email).toBe('admin@example.test');
    expect(user?.permissions['employee.delete']).toBe('ALL');
  });

  it('rejects a tampered, expired or re-keyed session', () => {
    const { value } = newLocalSession();
    const [expires, signature] = value.split('.');
    expect(readLocalSession(`${Number(expires) + 1000}.${signature}`)).toBeNull();
    expect(readLocalSession('garbage')).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Number(expires) + 1);
    expect(readLocalSession(value)).toBeNull();
    vi.useRealTimers();

    vi.stubEnv('LOGIN_PASSWORD', 'a new password');
    expect(readLocalSession(value)).toBeNull();
  });
});
