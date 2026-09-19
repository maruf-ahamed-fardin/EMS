import type { RoleItem, UserFormOptions, UserListItem } from '@ems/contracts';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { describeWithDatabase, DEMO_PASSWORD, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.12.${(ip = (ip % 250) + 1)}`;
type Role = keyof typeof DEMO_PEOPLE;

describeWithDatabase('users and roles', () => {
  let t: TestApp;
  const as = {} as Record<Role, TestBrowser>;
  const users = {} as Record<Role, string>;
  let roles: Record<string, string>;

  beforeAll(async () => {
    t = await startTestApp();
    for (const role of Object.keys(DEMO_PEOPLE) as Role[]) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
      users[role] = (await t.prisma.user.findUniqueOrThrow({ where: { email: DEMO_PEOPLE[role].email } })).id;
    }
    roles = Object.fromEntries((await t.prisma.role.findMany()).map((r) => [r.key, r.id]));
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('users', () => {
    it('lists accounts for user.view, with what the viewer may do; changes are Super Admin only', async () => {
      const list = (await as.hr_admin.get('/users?limit=100').expect(200)).body.data as UserListItem[];
      expect(list.find((u) => u.email === DEMO_PEOPLE.employee.email)).toMatchObject({
        name: 'Rahim Ahmed',
        role: { key: 'employee' },
        status: 'ACTIVE',
        allowedActions: { changeRole: false, deactivate: false, activate: false, sendReset: false },
      });
      expect((await as.manager.get('/users')).status).toBe(403);
      expect((await as.hr_admin.post('/users/' + users.employee + '/deactivate', {})).status).toBe(403);

      const mine = (await as.super_admin.get(`/users?q=superadmin`).expect(200)).body.data as UserListItem[];
      expect(mine[0]!.allowedActions).toEqual({ changeRole: false, deactivate: false, activate: false, sendReset: true });
    });

    it('creates an account for an employee without one, and emails a link to choose a password', async () => {
      const options = (await as.super_admin.get('/users/form-options').expect(200)).body.data as UserFormOptions;
      const person = options.employeesWithoutAccount[0]!;
      expect(options.roles.map((r) => r.key)).toEqual(expect.arrayContaining(['super_admin', 'hr_admin', 'manager', 'employee']));

      const res = await as.super_admin.post('/users', { employeeId: person.id, roleId: roles.employee });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ email: person.email, role: { key: 'employee' }, status: 'ACTIVE', lastLoginAt: null });
      expect(t.mailer.sent.at(-1)).toMatchObject({ to: person.email, subject: 'Your SeloraX People account' });
      expect(t.mailer.sent.at(-1)!.text).toMatch(/reset-password\?token=/);

      const again = await as.super_admin.post('/users', { employeeId: person.id, roleId: roles.employee });
      expect(again.status).toBe(409);
      expect(again.body.errors).toEqual({ employeeId: 'This employee already has an account' });
    });

    it('changes a role, and the new permissions apply on the next request', async () => {
      expect((await as.employee.get('/reports/employees')).status).toBe(403);
      const res = await as.super_admin.patch(`/users/${users.employee}/role`, { roleId: roles.manager });
      expect(res.status).toBe(200);
      expect(res.body.data.role.key).toBe('manager');
      expect((await as.employee.get('/reports/employees')).status).toBe(200);
      await as.super_admin.patch(`/users/${users.employee}/role`, { roleId: roles.employee });
      expect((await as.employee.get('/reports/employees')).status).toBe(403);
    });

    it('never locks the organization out', async () => {
      const own = await as.super_admin.patch(`/users/${users.super_admin}/role`, { roleId: roles.employee });
      expect(own.status).toBe(409);
      expect((await as.super_admin.post(`/users/${users.super_admin}/deactivate`, {})).status).toBe(409);

      // A second Super Admin can't demote the first while it would leave none... but can while there are two
      await t.prisma.user.update({ where: { id: users.hr_admin }, data: { roleId: roles.super_admin } });
      const second = new TestBrowser(t.app, nextIp());
      await second.login(DEMO_PEOPLE.hr_admin.email);
      expect((await second.patch(`/users/${users.super_admin}/role`, { roleId: roles.hr_admin })).status).toBe(200);
      const last = await as.super_admin.patch(`/users/${users.hr_admin}/role`, { roleId: roles.hr_admin });
      // The first account is no longer a Super Admin, so it can't manage users at all now
      expect(last.status).toBe(403);
      const lastStanding = await second.post(`/users/${users.hr_admin}/deactivate`, {});
      expect(lastStanding.status).toBe(409);
      // Put things back
      await t.prisma.user.update({ where: { id: users.super_admin }, data: { roleId: roles.super_admin } });
      await t.prisma.user.update({ where: { id: users.hr_admin }, data: { roleId: roles.hr_admin } });
    });

    it('deactivates (signing out everywhere), sends links only to active accounts, and activates with a lockout lifted', async () => {
      const off = await as.super_admin.post(`/users/${users.manager}/deactivate`, {});
      expect(off.status).toBe(200);
      expect(off.body.data.status).toBe('INACTIVE');
      expect((await as.manager.get('/auth/me')).status).toBe(401);
      expect((await as.super_admin.post(`/users/${users.manager}/send-reset`, {})).status).toBe(409);

      await t.prisma.user.update({ where: { id: users.manager }, data: { lockedUntil: new Date(Date.now() + 600_000), failedLoginCount: 9 } });
      const on = await as.super_admin.post(`/users/${users.manager}/activate`, {});
      expect(on.status).toBe(200);
      expect(on.body.data).toMatchObject({ status: 'ACTIVE', lockedUntil: null });
      as.manager = new TestBrowser(t.app, nextIp());
      expect((await as.manager.login(DEMO_PEOPLE.manager.email, DEMO_PASSWORD)).status).toBe(200);

      const link = await as.super_admin.post(`/users/${users.manager}/send-reset`, {});
      expect(link.status).toBe(200);
      expect(t.mailer.sent.at(-1)).toMatchObject({ to: DEMO_PEOPLE.manager.email, subject: 'Choose a new password for SeloraX People' });
      expect(await t.prisma.auditLog.count({ where: { action: { in: ['user.deactivated', 'user.activated', 'user.reset_link_sent'] }, entityId: users.manager } })).toBe(3);
    });
  });

  describe('account protection', () => {
    const employeeOf = async (role: Role) => (await t.prisma.user.findUniqueOrThrow({ where: { id: users[role] }, select: { employeeId: true } })).employeeId!;

    it('keeps Super Admin accounts, and the Super Admin role, out of reach of anyone who is not one', async () => {
      // A custom role holding everything HR has plus user and role management
      const hrGrants = await t.prisma.rolePermission.findMany({ where: { roleId: roles.hr_admin } });
      const admin = await t.prisma.permission.findMany({ where: { key: { in: ['user.manage', 'role.manage'] } } });
      const delegate = await t.prisma.role.create({ data: { key: 'delegate', name: 'Delegate', description: 'Test', isSystem: false } });
      await t.prisma.rolePermission.createMany({
        data: [...hrGrants.map((g) => ({ roleId: delegate.id, permissionId: g.permissionId, scope: g.scope })), ...admin.map((p) => ({ roleId: delegate.id, permissionId: p.id, scope: 'ALL' as const }))],
      });
      await t.prisma.user.update({ where: { id: users.hr_admin }, data: { roleId: delegate.id } });
      const hr = as.hr_admin;

      try {
        const options = (await hr.get('/users/form-options').expect(200)).body.data as UserFormOptions;
        expect(options.roles.map((r) => r.key)).not.toContain('super_admin');
        const list = (await hr.get('/users?q=superadmin').expect(200)).body.data as UserListItem[];
        expect(list[0]!.allowedActions).toEqual({ changeRole: false, deactivate: false, activate: false, sendReset: false });

        expect((await hr.patch(`/users/${users.super_admin}/role`, { roleId: roles.employee })).status).toBe(403);
        expect((await hr.patch(`/users/${users.employee}/role`, { roleId: roles.super_admin })).status).toBe(403);
        expect((await hr.post(`/users/${users.super_admin}/deactivate`, {})).status).toBe(403);
        expect((await hr.post(`/users/${users.super_admin}/send-reset`, {})).status).toBe(403);
        expect((await hr.post(`/employees/${await employeeOf('super_admin')}/deactivate`, {})).status).toBe(403);
        expect((await hr.patch(`/employees/${await employeeOf('super_admin')}`, { email: 'taken-over@example.com' })).status).toBe(403);

        // Roles: never its own, and never the two administration permissions
        expect((await hr.put(`/roles/${delegate.id}/permissions`, { permissions: {} })).status).toBe(409);
        const manager = ((await hr.get('/roles')).body.data as RoleItem[]).find((r) => r.key === 'manager')!;
        expect((await hr.put(`/roles/${roles.manager}/permissions`, { permissions: { ...manager.permissions, 'user.manage': 'ALL' } })).status).toBe(403);
        expect((await hr.put(`/roles/${roles.manager}/permissions`, { permissions: { ...manager.permissions, 'report.view': 'TEAM' } })).status).toBe(200);
        await hr.put(`/roles/${roles.manager}/permissions`, { permissions: manager.permissions });
        expect(((await hr.get('/roles')).body.data as RoleItem[]).find((r) => r.id === delegate.id)).toMatchObject({ editable: false });

        expect((await t.prisma.user.findUniqueOrThrow({ where: { id: users.super_admin } })).status).toBe('ACTIVE');
      } finally {
        await t.prisma.user.update({ where: { id: users.hr_admin }, data: { roleId: roles.hr_admin } });
        await t.prisma.rolePermission.deleteMany({ where: { roleId: delegate.id } });
        await t.prisma.role.delete({ where: { id: delegate.id } });
      }
    });

    it('only lets someone who manages accounts change a sign-in email, and tells the old address', async () => {
      const employee = await employeeOf('employee');
      const hrTry = await as.hr_admin.patch(`/employees/${employee}`, { email: 'rahim.new@demo.selorax.test' });
      expect(hrTry.status).toBe(403);
      expect(((await as.hr_admin.get(`/employees/${employee}`)).body.data as { allowedActions: { changeEmail: boolean } }).allowedActions.changeEmail).toBe(false);

      await as.super_admin.post(`/users/${users.employee}/send-reset`, {});
      const pendingLinks = () => t.prisma.passwordResetToken.count({ where: { userId: users.employee, usedAt: null } });
      expect(await pendingLinks()).toBe(1);
      const res = await as.super_admin.patch(`/employees/${employee}`, { email: 'rahim.new@demo.selorax.test' });
      expect(res.status).toBe(200);
      expect(await pendingLinks()).toBe(0);
      expect((await as.employee.get('/auth/me')).status).toBe(401);
      expect(t.mailer.sent.at(-1)).toMatchObject({ to: DEMO_PEOPLE.employee.email, subject: 'Your SeloraX People sign-in email changed' });

      await as.super_admin.patch(`/employees/${employee}`, { email: DEMO_PEOPLE.employee.email });
      as.employee = new TestBrowser(t.app, nextIp());
      expect((await as.employee.login(DEMO_PEOPLE.employee.email)).status).toBe(200);
    });

    it('leaves one Super Admin when two try to remove each other at the same moment', async () => {
      await t.prisma.user.update({ where: { id: users.hr_admin }, data: { roleId: roles.super_admin } });
      const second = new TestBrowser(t.app, nextIp());
      await second.login(DEMO_PEOPLE.hr_admin.email);

      const results = await Promise.all([as.super_admin.post(`/users/${users.hr_admin}/deactivate`, {}), second.post(`/users/${users.super_admin}/deactivate`, {})]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await t.prisma.user.count({ where: { status: 'ACTIVE', role: { key: 'super_admin' } } })).toBe(1);

      // Put things back, and sign the demo browsers in again
      await t.prisma.user.updateMany({ where: { id: { in: [users.super_admin, users.hr_admin] } }, data: { status: 'ACTIVE' } });
      await t.prisma.user.update({ where: { id: users.hr_admin }, data: { roleId: roles.hr_admin } });
      for (const role of ['super_admin', 'hr_admin'] as const) {
        as[role] = new TestBrowser(t.app, nextIp());
        expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
      }
    });
  });

  describe('roles', () => {
    it('shows every role and the catalogue, only to role.manage', async () => {
      const list = (await as.super_admin.get('/roles').expect(200)).body.data as RoleItem[];
      expect(list.find((r) => r.key === 'super_admin')).toMatchObject({ editable: false });
      expect(list.find((r) => r.key === 'manager')).toMatchObject({ editable: true, permissions: expect.objectContaining({ 'leave.approve': 'TEAM' }) });
      expect((await as.hr_admin.get('/roles')).status).toBe(403);
      expect((await as.hr_admin.put(`/roles/${roles.manager}/permissions`, { permissions: {} })).status).toBe(403);
    });

    it('replaces a role’s grants, applies them at once, and records exactly what changed', async () => {
      const before = ((await as.super_admin.get('/roles')).body.data as RoleItem[]).find((r) => r.key === 'employee')!;
      expect((await as.employee.get('/reports/employees')).status).toBe(403);

      const res = await as.super_admin.put(`/roles/${roles.employee}/permissions`, { permissions: { ...before.permissions, 'report.view': 'OWN' } });
      expect(res.status).toBe(200);
      expect(res.body.data.permissions['report.view']).toBe('OWN');
      expect((await as.employee.get('/reports/employees')).status).toBe(200);

      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'role.permissions_changed' }, orderBy: { createdAt: 'desc' } });
      expect(audit.before).toEqual({ key: 'employee', permissions: { 'report.view': null } });
      expect(audit.after).toEqual({ key: 'employee', permissions: { 'report.view': 'OWN' } });

      await as.super_admin.put(`/roles/${roles.employee}/permissions`, { permissions: before.permissions });
      expect((await as.employee.get('/reports/employees')).status).toBe(403);
    });

    it("won't edit Super Admin, and refuses unknown permissions and scopes", async () => {
      expect((await as.super_admin.put(`/roles/${roles.super_admin}/permissions`, { permissions: {} })).status).toBe(409);
      expect((await as.super_admin.put(`/roles/${roles.manager}/permissions`, { permissions: { 'salary.view': 'ALL' } })).status).toBe(422);
      expect((await as.super_admin.put(`/roles/${roles.manager}/permissions`, { permissions: { 'employee.view': 'COMPANY' } })).status).toBe(422);
    });
  });
});
