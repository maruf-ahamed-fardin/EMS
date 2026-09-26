import type { LeaveTypeItem, NotificationItem } from '@/lib/validations';
import { DEMO_PEOPLE } from '@/prisma/demo-data';
import { AttendanceService } from '@/lib/services/attendance/attendance.service';
import { FixedClock } from '@/lib/http/clock';
import { NotificationService } from '@/lib/services/notifications/notifications.service';
import { DEMO_PASSWORD, describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.9.${(ip = (ip % 250) + 1)}`;
const DHAKA = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`);
type Role = keyof typeof DEMO_PEOPLE;

// 2026-09: Fridays are 18 and 25. 16 Sep is a Wednesday.
describeWithDatabase('notifications', () => {
  let t: TestApp;
  const clock = new FixedClock(DHAKA('2026-09-17', '09:00'));
  const as = {} as Record<Role, TestBrowser>;
  const userIds = {} as Record<Role, string>;
  let annual: LeaveTypeItem;

  /** Notifications of one type, as `role:title` pairs, sorted. */
  const sent = async (type: string) => {
    const rows = await t.prisma.notification.findMany({ where: { type }, select: { title: true, user: { select: { email: true } } } });
    const role = (email: string) => (Object.keys(DEMO_PEOPLE) as Role[]).find((r) => DEMO_PEOPLE[r].email === email) ?? email;
    return rows.map((r) => `${role(r.user.email)}: ${r.title}`).sort();
  };

  beforeAll(async () => {
    t = await startTestApp({ clock });
    for (const role of Object.keys(DEMO_PEOPLE) as Role[]) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
      userIds[role] = (await t.prisma.user.findUniqueOrThrow({ where: { email: DEMO_PEOPLE[role].email } })).id;
    }
    annual = (await as.hr_admin.post('/leave/types', { name: 'Annual', code: 'ANNUAL', defaultDaysPerYear: 18 })).body.data as LeaveTypeItem;
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('triggers', () => {
    let requestId: string;

    it('tells the manager and everyone who approves all leave about a request, never the requester', async () => {
      const res = await as.employee.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-09-22', endDate: '2026-09-24', reason: 'Family visit' });
      expect(res.status).toBe(201);
      requestId = res.body.data.id;
      expect(await sent('leave.requested')).toEqual([
        'hr_admin: Rahim Ahmed asked for 3 days of Annual leave',
        'manager: Rahim Ahmed asked for 3 days of Annual leave',
        'super_admin: Rahim Ahmed asked for 3 days of Annual leave',
      ]);
      const row = await t.prisma.notification.findFirstOrThrow({ where: { type: 'leave.requested', userId: userIds.manager } });
      expect(row).toMatchObject({ body: '22–24 Sep: Family visit', link: '/leave/requests', entityType: 'leave_request', entityId: requestId });
    });

    it('sends nothing when the change itself fails', async () => {
      const before = await t.prisma.notification.count();
      const overlap = await as.employee.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-09-23', endDate: '2026-09-23', reason: 'Again' });
      expect(overlap.status).toBe(409);
      expect(await t.prisma.notification.count()).toBe(before);
    });

    it('tells the employee once when their leave is decided', async () => {
      expect((await as.manager.patch(`/leave/requests/${requestId}/approve`, { note: 'Enjoy' })).status).toBe(200);
      expect((await as.hr_admin.patch(`/leave/requests/${requestId}/approve`, {})).status).toBe(409);
      expect(await sent('leave.approved')).toEqual(['employee: Your Annual leave was approved']);
      expect((await t.prisma.notification.findFirstOrThrow({ where: { type: 'leave.approved' } })).body).toBe('22–24 Sep, 3 days. Note: Enjoy');

      const second = await as.employee.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-09-29', endDate: '2026-09-29', reason: 'Errands' });
      expect((await as.manager.patch(`/leave/requests/${second.body.data.id}/reject`, { note: 'Release day' })).status).toBe(200);
      expect(await sent('leave.rejected')).toEqual(['employee: Your Annual leave was rejected']);
      expect((await t.prisma.notification.findFirstOrThrow({ where: { type: 'leave.rejected' } })).body).toBe('29 Sep, 1 day. Reason: Release day');
    });

    it("doesn't tell a manager about their own request", async () => {
      const res = await as.manager.post('/leave/requests', { leaveTypeId: annual.id, startDate: '2026-10-05', endDate: '2026-10-05', reason: 'Dentist' });
      expect(res.status).toBe(201);
      const rows = await t.prisma.notification.findMany({ where: { entityId: res.body.data.id }, select: { userId: true } });
      expect(rows.map((r) => r.userId).sort()).toEqual([userIds.hr_admin, userIds.super_admin].sort());
    });

    it('tells HR about a new employee, except whoever added them', async () => {
      const options = (await as.hr_admin.get('/employees/form-options')).body.data;
      const dev = options.departments.find((d: { code: string }) => d.code === 'DEV');
      const position = options.positions.find((p: { departmentId: string }) => p.departmentId === dev.id);
      const hire = await as.hr_admin.post('/employees', {
        firstName: 'Nadia', lastName: 'Karim', dateOfBirth: '1997-03-02', departmentId: dev.id, positionId: position.id, joiningDate: '2026-10-01',
        employmentType: 'FULL_TIME', workLocation: 'Dhaka office', email: 'nadia.karim@demo.selorax.test', phone: '+8801711000009',
        address: { line1: 'House 9', city: 'Dhaka', country: 'Bangladesh' }, emergencyContact: { name: 'Kin', relationship: 'Sister', phone: '+8801811000009' },
      });
      expect(hire.status).toBe(201);
      expect(await sent('employee.created')).toEqual([`super_admin: Nadia Karim joins ${dev.name}`]);
      const row = await t.prisma.notification.findFirstOrThrow({ where: { type: 'employee.created' } });
      expect(row.body).toBe(`${hire.body.data.employeeCode} · ${position.title} · starts 1 Oct`);
      expect(row.link).toBe(`/employees/${hire.body.data.id}`);
    });

    it('tells someone every time their password changes', async () => {
      const browser = new TestBrowser(t.app, nextIp());
      await browser.login(DEMO_PEOPLE.employee.email);
      expect((await browser.post('/auth/change-password', { currentPassword: DEMO_PASSWORD, newPassword: 'quiet-harbour-lantern-58' })).status).toBe(204);
      expect((await browser.post('/auth/change-password', { currentPassword: 'quiet-harbour-lantern-58', newPassword: DEMO_PASSWORD })).status).toBe(204);
      expect(await sent('auth.password_changed')).toEqual(['employee: Your password was changed', 'employee: Your password was changed']);
      // Changing the password signed out the employee's other sessions, the shared test browser's included
      as.employee = new TestBrowser(t.app, nextIp());
      expect((await as.employee.login(DEMO_PEOPLE.employee.email)).status).toBe(200);
    });

    it('sums up a closed day for attendance managers, once', async () => {
      const attendance = t.app.get(AttendanceService);
      const closed = await attendance.closeDay('2026-09-16');
      expect(closed.created).toBeGreaterThan(0);
      await attendance.closeDay('2026-09-16');
      const rows = await sent('attendance.issues');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatch(/^hr_admin: 16 Sep: \d+ people were absent$/);
      expect(rows[1]).toMatch(/^super_admin: 16 Sep: \d+ people were absent$/);
      // A weekend closes without a word
      await attendance.closeDay('2026-09-18');
      expect(await sent('attendance.issues')).toHaveLength(2);
    });

    it('skips a second notify with the same dedupe key', async () => {
      const service = t.app.get(NotificationService);
      const input = { userIds: [userIds.employee], type: 'document.expiring' as const, title: 'x', body: 'y', dedupeKey: 'test:once' };
      expect(await service.notify(input)).toBe(1);
      expect(await service.notify(input)).toBe(0);
      expect(await service.notify({ ...input, userIds: [userIds.employee, userIds.manager] })).toBe(1);
    });
  });

  describe('API', () => {
    it("lists and counts only the caller's own notifications", async () => {
      const mine = (await as.employee.get('/notifications').expect(200)).body;
      const own = await t.prisma.notification.count({ where: { userId: userIds.employee } });
      expect(mine.meta.total).toBe(own);
      expect((await as.employee.get('/notifications/unread-count').expect(200)).body.data).toEqual({ count: own });
      expect((mine.data as NotificationItem[])[0]).toEqual(expect.objectContaining({ readAt: null, createdAt: expect.any(String) }));
      expect(Object.keys(mine.data[0]).sort()).toEqual(['body', 'createdAt', 'id', 'link', 'readAt', 'title', 'type']);
      expect((await new TestBrowser(t.app, nextIp()).get('/notifications')).status).toBe(401);
    });

    it("marks one read, but answers 404 for someone else's", async () => {
      const managers = await t.prisma.notification.findFirstOrThrow({ where: { userId: userIds.manager } });
      expect((await as.employee.patch(`/notifications/${managers.id}/read`, {})).status).toBe(404);
      expect((await t.prisma.notification.findUniqueOrThrow({ where: { id: managers.id } })).readAt).toBeNull();

      const res = await as.manager.patch(`/notifications/${managers.id}/read`, {});
      expect(res.status).toBe(200);
      expect(res.body.data.readAt).not.toBeNull();
      const again = await as.manager.patch(`/notifications/${managers.id}/read`, {});
      expect(again.body.data.readAt).toBe(res.body.data.readAt);
    });

    it('filters unread and marks all read', async () => {
      const unread = (await as.employee.get('/notifications?unread=true').expect(200)).body.meta.total as number;
      expect(unread).toBeGreaterThan(0);
      expect((await as.employee.patch('/notifications/read-all', {})).body.data).toEqual({ updated: unread });
      expect((await as.employee.get('/notifications/unread-count')).body.data).toEqual({ count: 0 });
      // Nobody else's were touched
      expect(await t.prisma.notification.count({ where: { userId: userIds.hr_admin, readAt: null } })).toBeGreaterThan(0);
    });
  });
});
