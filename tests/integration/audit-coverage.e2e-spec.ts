import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/validations';
import { NO_AUDIT } from '@/lib/services/audit/audit-coverage';
import { describeWithDatabase, type TestApp, startTestApp } from './support/test-app';

/**
 * Every write endpoint and what it records (plan §8). A new endpoint fails this test until it is added
 * here, either with the actions it writes or as exempt; an exempt one must also carry `@NoAudit(reason)`.
 * That the listed actions are really written is checked by the other e2e suites: in tests, a successful
 * write that records nothing fails with 500 (AUDIT_STRICT).
 */
const WRITE_ROUTES: Record<string, { audits: AuditAction[] } | 'exempt'> = {
  'POST /attendance/check-in': 'exempt',
  'POST /attendance/check-out': 'exempt',
  'POST /attendance': { audits: ['attendance.corrected'] },
  'POST /attendance/close-day': { audits: ['attendance.day_closed'] },
  'PATCH /attendance/:id': { audits: ['attendance.corrected'] },
  'POST /auth/login': { audits: ['auth.login', 'auth.login_failed'] },
  'POST /auth/logout': { audits: ['auth.logout'] },
  'POST /auth/logout-others': { audits: ['auth.sessions_revoked'] },
  'POST /auth/forgot-password': 'exempt',
  'POST /auth/reset-password': { audits: ['auth.password_reset'] },
  'POST /auth/change-password': { audits: ['auth.password_changed'] },
  'POST /employees': { audits: ['employee.created', 'user.created'] },
  'PATCH /employees/:id': { audits: ['employee.updated'] },
  'POST /employees/:id/deactivate': { audits: ['employee.deactivated'] },
  'POST /employees/:id/reactivate': { audits: ['employee.reactivated'] },
  'DELETE /employees/:id': { audits: ['employee.deleted'] },
  'PATCH /me/profile': { audits: ['employee.updated'] },
  'POST /departments': { audits: ['department.created'] },
  'PATCH /departments/:id': { audits: ['department.updated'] },
  'DELETE /departments/:id': { audits: ['department.deleted'] },
  'POST /positions': { audits: ['position.created'] },
  'PATCH /positions/:id': { audits: ['position.updated'] },
  'DELETE /positions/:id': { audits: ['position.deleted'] },
  'PATCH /settings/attendance': { audits: ['settings.updated'] },
  'POST /holidays': { audits: ['holiday.created'] },
  'DELETE /holidays/:id': { audits: ['holiday.deleted'] },
  'POST /leave/preview': 'exempt',
  'POST /leave/requests': { audits: ['leave.requested'] },
  'PATCH /leave/requests/:id/approve': { audits: ['leave.approved'] },
  'PATCH /leave/requests/:id/reject': { audits: ['leave.rejected'] },
  'PATCH /leave/requests/:id/cancel': { audits: ['leave.cancelled'] },
  'PATCH /leave/balances/:id': { audits: ['leave_balance.adjusted'] },
  'POST /leave/balances/allocate': { audits: ['leave_balance.allocated'] },
  'POST /leave/types': { audits: ['leave_type.created'] },
  'PATCH /leave/types/:id': { audits: ['leave_type.updated'] },
  'DELETE /leave/types/:id': { audits: ['leave_type.deleted'] },
  'POST /employees/:id/documents': { audits: ['document.uploaded'] },
  'PATCH /team-profile/me': { audits: ['team_profile.updated'] },
  'POST /team-profile/me/photo': { audits: ['team_profile.photo_updated'] },
  'DELETE /team-profile/me/photo': { audits: ['team_profile.photo_removed'] },
  'DELETE /documents/:id': { audits: ['document.deleted'] },
  'POST /document-types': { audits: ['document_type.created'] },
  'PATCH /document-types/:id': { audits: ['document_type.updated'] },
  'DELETE /document-types/:id': { audits: ['document_type.deleted'] },
  'POST /users': { audits: ['user.created'] },
  'PATCH /users/:id/role': { audits: ['user.role_changed'] },
  'POST /users/:id/deactivate': { audits: ['user.deactivated'] },
  'POST /users/:id/activate': { audits: ['user.activated'] },
  'POST /users/:id/send-reset': { audits: ['user.reset_link_sent'] },
  'PUT /roles/:id/permissions': { audits: ['role.permissions_changed'] },
  'PATCH /notifications/read-all': 'exempt',
  'PATCH /notifications/:id/read': 'exempt',
};

const WRITE_METHODS: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

function join(...parts: string[]): string {
  return `/${parts.map((p) => p.replace(/^\/|\/$/g, '')).filter(Boolean).join('/')}`;
}

describeWithDatabase('audit coverage', () => {
  let t: TestApp;
  /** "METHOD /path" → the @NoAudit reason, or null. */
  const routes = new Map<string, string | null>();

  beforeAll(async () => {
    t = await startTestApp();
    const scanner = new MetadataScanner();
    for (const wrapper of t.app.get(DiscoveryService).getControllers()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || !wrapper.metatype) continue;
      const prefix = Reflect.getMetadata(PATH_METADATA, wrapper.metatype) as string;
      for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance) as object)) {
        const handler = instance[name] as object;
        const method = WRITE_METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        if (!method || path === undefined) continue;
        routes.set(`${method} ${join(prefix, path)}`, (Reflect.getMetadata(NO_AUDIT, handler) as string | undefined) ?? null);
      }
    }
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  it('knows every write endpoint, and every listed one exists', () => {
    expect(routes.size).toBeGreaterThan(30);
    expect([...routes.keys()].filter((r) => !(r in WRITE_ROUTES))).toEqual([]);
    expect(Object.keys(WRITE_ROUTES).filter((r) => !routes.has(r))).toEqual([]);
  });

  it('exempts exactly the endpoints marked @NoAudit, each with a reason', () => {
    const marked = [...routes].filter(([, reason]) => reason !== null);
    expect(marked.map(([route]) => route).sort()).toEqual(Object.keys(WRITE_ROUTES).filter((r) => WRITE_ROUTES[r] === 'exempt').sort());
    for (const [, reason] of marked) expect(reason!.length).toBeGreaterThan(20);
  });

  it('lists only actions the viewer knows', () => {
    const listed = Object.values(WRITE_ROUTES).flatMap((entry) => (entry === 'exempt' ? [] : entry.audits));
    for (const action of listed) expect(Object.keys(AUDIT_ACTIONS)).toContain(action);
  });
});
