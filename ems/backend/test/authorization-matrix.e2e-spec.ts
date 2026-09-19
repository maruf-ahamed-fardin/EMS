import { DEFAULT_ROLE_GRANTS, type SystemRoleKey } from '@ems/contracts';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

type Expectation = Record<'anonymous' | SystemRoleKey, number>;

/**
 * Plan §13: every role against every protected route. A new protected route adds a row here; a route
 * missing from this table has no proof its permission check works.
 */
const MATRIX: Array<{ method: 'get'; path: string; expect: Expectation }> = [
  { method: 'get', path: '/auth/me', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/roles', expect: { anonymous: 401, super_admin: 200, hr_admin: 403, manager: 403, employee: 403 } },
  { method: 'get', path: '/permissions', expect: { anonymous: 401, super_admin: 200, hr_admin: 403, manager: 403, employee: 403 } },
  { method: 'get', path: '/health', expect: { anonymous: 200, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  // Employee lists are scoped rather than forbidden: an employee's list holds only their own record
  { method: 'get', path: '/employees', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/employees/form-options', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 403, employee: 403 } },
  { method: 'get', path: '/employees/check-unique?email=a@b.co', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 403, employee: 403 } },
  { method: 'get', path: '/me/profile', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/departments', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/departments/head-options', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 403, employee: 403 } },
  { method: 'get', path: '/positions', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/dashboard/overview', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/dashboard/attendance-trend', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 403 } },
  { method: 'get', path: '/search?q=sx', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/attendance', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/attendance/today', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/attendance/summary?from=2026-09-01&to=2026-09-30', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/settings/attendance', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 403, employee: 403 } },
  { method: 'get', path: '/holidays', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/leave/requests', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/leave/balances', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/leave/types', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/documents', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/document-types', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/notifications', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/notifications/unread-count', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 200 } },
  { method: 'get', path: '/reports/employees', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 403 } },
  { method: 'get', path: '/audit-logs', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 403, employee: 403 } },
  { method: 'get', path: '/reports/departments?from=2026-01-01&to=2026-09-30', expect: { anonymous: 401, super_admin: 200, hr_admin: 200, manager: 200, employee: 403 } },
  // Download tokens are their own authority; a made-up one is simply not found
  { method: 'get', path: '/files/made-up-token', expect: { anonymous: 404, super_admin: 404, hr_admin: 404, manager: 404, employee: 404 } },
];

const ROLES = Object.keys(DEMO_PEOPLE) as SystemRoleKey[];

describeWithDatabase('authorization matrix', () => {
  let t: TestApp;
  const browsers = {} as Record<'anonymous' | SystemRoleKey, TestBrowser>;

  beforeAll(async () => {
    t = await startTestApp();
    browsers.anonymous = new TestBrowser(t.app, '198.51.100.1');
    for (const [index, role] of ROLES.entries()) {
      browsers[role] = new TestBrowser(t.app, `198.51.100.${index + 2}`);
      const res = await browsers[role].login(DEMO_PEOPLE[role].email);
      expect(res.status).toBe(200);
    }
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  for (const route of MATRIX) {
    for (const who of ['anonymous', ...ROLES] as const) {
      it(`${route.method.toUpperCase()} ${route.path} as ${who} → ${route.expect[who]}`, async () => {
        const res = await browsers[who][route.method](route.path);
        expect(res.status).toBe(route.expect[who]);
      });
    }
  }

  it.each(ROLES)('reports the seeded permissions for %s', async (role) => {
    const res = await browsers[role].get('/auth/me').expect(200);
    expect(res.body.data).toMatchObject({ email: DEMO_PEOPLE[role].email, role: { key: role } });
    expect(res.body.data.permissions).toEqual(DEFAULT_ROLE_GRANTS[role]);
  });

  it('never exposes password hashes or token hashes', async () => {
    const bodies = await Promise.all([browsers.super_admin.get('/auth/me'), browsers.super_admin.get('/roles')]);
    for (const res of bodies) expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash|\$argon2/);
  });
});
