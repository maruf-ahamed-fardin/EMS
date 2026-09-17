import { DEFAULT_ROLE_GRANTS } from '@ems/contracts';
import { auditView } from '../audit/redaction';
import { generateToken, hashToken, safeEqual } from '../common/security/tokens';
import type { AuthContext } from './auth-context';
import { checkCsrf, type CsrfRequest } from './guards/csrf.guard';
import { throttleTracker } from './guards/throttler.guard';
import { checkPassword } from './password-policy';
import { ScopeService } from './scope.service';
import { SESSION_IDLE_MS, sessionState, shouldTouch } from './session-policy';

describe('tokens', () => {
  it('are 43 url-safe characters and unique', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hash to a stable sha256 hex that differs from the token', () => {
    const token = generateToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });

  it('compare safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('checkPassword', () => {
  it('accepts a reasonable password', () => {
    expect(checkPassword('river-lantern-47', 'rahim@demo.selorax.test')).toBeNull();
  });

  it.each([
    ['short1', 'too_short'],
    ['x'.repeat(129), 'too_long'],
    ['Password123', 'common'],
    ['1q2w3e4r5t', 'common'],
    ['aaaaabbbbb', 'repetitive'],
    ['rahim.ahmed-2026', 'contains_email'],
  ])('rejects %s as %s', (password, problem) => {
    expect(checkPassword(password, 'rahim.ahmed@demo.selorax.test')).toBe(problem);
  });
});

describe('sessionState', () => {
  const now = new Date('2026-09-17T10:00:00Z');
  const base = { expiresAt: new Date('2026-09-20T00:00:00Z'), lastSeenAt: new Date('2026-09-17T09:00:00Z'), revokedAt: null };

  it('is active within both limits', () => expect(sessionState(base, now)).toBe('active'));
  it('is revoked first', () => expect(sessionState({ ...base, revokedAt: now }, now)).toBe('revoked'));
  it('expires at the absolute limit', () => expect(sessionState({ ...base, expiresAt: now }, now)).toBe('expired'));
  it('goes idle after 8 hours without activity', () => {
    expect(sessionState({ ...base, lastSeenAt: new Date(now.getTime() - SESSION_IDLE_MS) }, now)).toBe('idle');
    expect(sessionState({ ...base, lastSeenAt: new Date(now.getTime() - SESSION_IDLE_MS + 1000) }, now)).toBe('active');
  });

  it('writes last_seen_at at most once a minute', () => {
    expect(shouldTouch(new Date(now.getTime() - 30_000), now)).toBe(false);
    expect(shouldTouch(new Date(now.getTime() - 60_000), now)).toBe(true);
  });
});

describe('checkCsrf', () => {
  const allowed = new Set(['http://localhost:3000']);
  const write: CsrfRequest = {
    method: 'POST',
    origin: 'http://localhost:3000',
    fetchSite: 'same-origin',
    cookieToken: 'token-value-1234567890',
    headerToken: 'token-value-1234567890',
  };

  it('lets reads through without any checks', () => {
    expect(checkCsrf({ ...write, method: 'GET', origin: 'https://evil.example', headerToken: undefined }, allowed)).toBe('ok');
  });

  it('accepts a same-origin write with matching tokens', () => expect(checkCsrf(write, allowed)).toBe('ok'));

  it('rejects cross-site requests', () => {
    expect(checkCsrf({ ...write, fetchSite: 'cross-site' }, allowed)).toBe('cross_site');
    expect(checkCsrf({ ...write, fetchSite: 'same-site' }, allowed)).toBe('cross_site');
  });

  it('rejects a foreign origin', () => expect(checkCsrf({ ...write, origin: 'https://evil.example' }, allowed)).toBe('bad_origin'));

  it('requires both halves of the token, and that they match', () => {
    expect(checkCsrf({ ...write, headerToken: undefined }, allowed)).toBe('missing_token');
    expect(checkCsrf({ ...write, cookieToken: undefined }, allowed)).toBe('missing_token');
    expect(checkCsrf({ ...write, headerToken: 'token-value-0000000000' }, allowed)).toBe('token_mismatch');
  });

  it('still needs the token when a client sends no Origin or Sec-Fetch-Site', () => {
    expect(checkCsrf({ ...write, origin: undefined, fetchSite: undefined, headerToken: undefined }, allowed)).toBe('missing_token');
  });
});

describe('throttleTracker', () => {
  it('counts sign-in attempts per IP and email', () => {
    expect(throttleTracker({ ip: '10.0.0.1', body: { email: ' Rahim@Demo.SeloraX.test ' } } as never)).toBe(
      'ip:10.0.0.1|email:rahim@demo.selorax.test',
    );
  });

  it('counts signed-in requests per session, others per IP', () => {
    expect(throttleTracker({ ip: '10.0.0.1', body: {}, auth: { sessionId: 's1' } } as never)).toBe('session:s1');
    expect(throttleTracker({ ip: '10.0.0.1', body: undefined } as never)).toBe('ip:10.0.0.1');
  });
});

describe('ScopeService.employeeWhere', () => {
  const scope = new ScopeService();
  const auth = (role: keyof typeof DEFAULT_ROLE_GRANTS, employeeId: string | null = 'emp-1'): AuthContext => ({
    sessionId: 's',
    user: { id: 'u', email: 'x@y.z', name: 'X', employeeId, role: { id: 'r', key: role, name: role } },
    permissions: DEFAULT_ROLE_GRANTS[role],
  });
  const nothing = { id: { in: [] } };

  it('gives HR everyone who is not deleted', () => {
    expect(scope.employeeWhere(auth('hr_admin'), 'employee.view')).toEqual({ deletedAt: null });
  });

  it('gives a manager themselves and their direct reports', () => {
    expect(scope.employeeWhere(auth('manager'), 'employee.view')).toEqual({
      deletedAt: null,
      OR: [{ id: 'emp-1' }, { managerId: 'emp-1' }],
    });
  });

  it('gives an employee only their own record', () => {
    expect(scope.employeeWhere(auth('employee'), 'employee.view')).toEqual({ deletedAt: null, id: 'emp-1' });
  });

  it('matches nothing without the permission', () => {
    expect(scope.employeeWhere(auth('employee'), 'employee.delete')).toEqual(nothing);
  });

  it('matches nothing for OWN or TEAM when the user has no employee record', () => {
    expect(scope.employeeWhere(auth('manager', null), 'employee.view')).toEqual(nothing);
    expect(scope.employeeWhere(auth('employee', null), 'employee.view')).toEqual(nothing);
  });
});

describe('auditView', () => {
  it('keeps only allow-listed fields', () => {
    expect(auditView('user', { email: 'a@b.c', status: 'ACTIVE', lastLoginAt: new Date() })).toEqual({
      email: 'a@b.c',
      status: 'ACTIVE',
    });
  });

  it('never writes secrets, even nested', () => {
    const view = auditView('role', { name: 'HR', permissions: { note: 'x', tokenHash: 'abc', nested: { password: 'p' } } });
    expect(JSON.stringify(view)).not.toMatch(/tokenHash|password/);
  });

  it('drops everything for an entity without an allow-list', () => {
    expect(auditView('unknown', { anything: 1 })).toBeNull();
  });
});
