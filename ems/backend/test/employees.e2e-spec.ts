import type { EmployeeDetail, EmployeeListItem } from '@ems/contracts';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.0.${(ip = (ip % 250) + 1)}`;

describeWithDatabase('employees', () => {
  let t: TestApp;
  const as = {} as Record<keyof typeof DEMO_PEOPLE, TestBrowser>;
  let ids: { hr: string; manager: string; employee: string; otherTeam: string; managersReport: string };

  async function codeToId(code: string) {
    return (await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: code, deletedAt: null } })).id;
  }

  beforeAll(async () => {
    t = await startTestApp();
    for (const role of Object.keys(DEMO_PEOPLE) as Array<keyof typeof DEMO_PEOPLE>) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
    const manager = await codeToId('SX-003');
    const otherTeam = await t.prisma.employee.findFirstOrThrow({ where: { department: { code: 'SAL' }, deletedAt: null } });
    ids = {
      hr: await codeToId('SX-002'),
      manager,
      employee: await codeToId('SX-004'),
      otherTeam: otherTeam.id,
      managersReport: (await t.prisma.employee.findFirstOrThrow({ where: { managerId: manager, employeeCode: { not: 'SX-004' } } })).id,
    };
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  const patch = (browser: TestBrowser, path: string, body: object) => browser.patch(path, body);
  const del = (browser: TestBrowser, path: string) => browser.delete(path);

  describe('list scope', () => {
    it('shows HR everyone who is not deleted', async () => {
      const res = await as.hr_admin.get('/employees?limit=100').expect(200);
      expect(res.body.meta.total).toBe(60);
    });

    it('shows a manager only themselves and their direct reports', async () => {
      const res = await as.manager.get('/employees?limit=100').expect(200);
      const people = res.body.data as EmployeeListItem[];
      const reports = await t.prisma.employee.count({ where: { managerId: ids.manager, deletedAt: null } });
      expect(people).toHaveLength(reports + 1);
      expect(people.every((p) => p.id === ids.manager || p.manager?.id === ids.manager)).toBe(true);
    });

    it('shows an employee only their own record', async () => {
      const res = await as.employee.get('/employees').expect(200);
      expect(res.body.data.map((p: EmployeeListItem) => p.id)).toEqual([ids.employee]);
    });

    it('searches, filters and pages', async () => {
      const search = await as.hr_admin.get('/employees?q=tanvir%20has').expect(200);
      expect(search.body.data.map((p: EmployeeListItem) => p.employeeCode)).toContain('SX-003');

      const inactive = await as.hr_admin.get('/employees?status=INACTIVE').expect(200);
      expect(inactive.body.data.every((p: EmployeeListItem) => p.status === 'INACTIVE')).toBe(true);

      const page2 = await as.hr_admin.get('/employees?limit=25&page=2&sort=code').expect(200);
      expect(page2.body.meta).toEqual({ page: 2, limit: 25, total: 60, totalPages: 3 });
      expect(page2.body.data[0].employeeCode).toBe('SX-026');
    });

    it('never returns internal columns', async () => {
      const res = await as.hr_admin.get(`/employees/${ids.employee}`).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/photoKey|passwordHash|deletedAt/);
    });
  });

  describe('detail and private fields', () => {
    it('answers 404, not 403, for someone outside your scope', async () => {
      await as.manager.get(`/employees/${ids.otherTeam}`).expect(404);
      await as.employee.get(`/employees/${ids.manager}`).expect(404);
      await as.employee.get('/employees/not-a-uuid').expect(404);
    });

    it('hides private details from a manager, even for their own report', async () => {
      const res = await as.manager.get(`/employees/${ids.employee}`).expect(200);
      expect((res.body.data as EmployeeDetail).private).toBeNull();
    });

    it('shows private details to HR and to the person themselves', async () => {
      expect((await as.hr_admin.get(`/employees/${ids.employee}`)).body.data.private).toMatchObject({ address: { city: expect.any(String) } });
      expect((await as.employee.get(`/employees/${ids.employee}`)).body.data.private).not.toBeNull();
    });

    it('offers actions that match the viewer', async () => {
      expect((await as.hr_admin.get(`/employees/${ids.employee}`)).body.data.allowedActions).toEqual({
        update: true,
        deactivate: true,
        reactivate: false,
        delete: false,
      });
      expect((await as.manager.get(`/employees/${ids.employee}`)).body.data.allowedActions.update).toBe(false);
    });
  });

  describe('create', () => {
    const newHire = async () => {
      const options = (await as.hr_admin.get('/employees/form-options').expect(200)).body.data;
      const dev = options.departments.find((d: { code: string }) => d.code === 'DEV');
      const qa = options.positions.find((p: { title: string; departmentId: string }) => p.title === 'QA Engineer' && p.departmentId === dev.id);
      return {
        options,
        body: {
          firstName: 'Tahmina',
          lastName: 'Sultana',
          dateOfBirth: '1997-05-02',
          departmentId: dev.id,
          positionId: qa.id,
          managerId: ids.manager,
          joiningDate: '2026-09-21',
          employmentType: 'FULL_TIME',
          workLocation: 'Dhaka office',
          email: 'tahmina.sultana@demo.selorax.test',
          phone: '+8801711204318',
          address: { line1: 'House 14, Road 7', city: 'Dhaka', country: 'Bangladesh' },
          emergencyContact: { name: 'Shirin Sultana', relationship: 'Sister', phone: '+8801819552011' },
          createAccount: true,
        },
      };
    };

    it('creates the record with the next code, an invite and an audit entry', async () => {
      const { options, body } = await newHire();
      expect(options.nextEmployeeCode).toBe('SX-061');
      expect(options.roles).toEqual([{ key: 'employee', name: 'Employee' }]);

      t.mailer.sent.length = 0;
      const res = await as.hr_admin.post('/employees', body);
      expect(res.status).toBe(201);
      const created = res.body.data as EmployeeDetail;
      expect(created).toMatchObject({ employeeCode: 'SX-061', fullName: 'Tahmina Sultana', manager: { id: ids.manager } });
      expect(created.account).toMatchObject({ email: body.email, role: { key: 'employee' } });

      expect(t.mailer.sent).toHaveLength(1);
      expect(t.mailer.sent[0]?.text).toMatch(/reset-password\?token=/);
      expect(await t.prisma.auditLog.count({ where: { action: 'employee.created', entityId: created.id } })).toBe(1);
    });

    it('refuses a duplicate email and names the owner', async () => {
      const { body } = await newHire();
      const res = await as.hr_admin.post('/employees', { ...body, email: DEMO_PEOPLE.employee.email, createAccount: false });
      expect(res.status).toBe(409);
      expect(res.body.errors).toEqual({ email: 'Already used by SX-004' });
    });

    it('refuses a position from another department', async () => {
      const { options, body } = await newHire();
      const salesPosition = options.positions.find((p: { title: string }) => p.title === 'Account Executive');
      const res = await as.hr_admin.post('/employees', { ...body, email: 'x1@demo.selorax.test', positionId: salesPosition.id, createAccount: false });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({ positionId: 'Choose a position in Development' });
    });

    it('does not let HR create accounts with other roles', async () => {
      const { body } = await newHire();
      const res = await as.hr_admin.post('/employees', { ...body, email: 'x2@demo.selorax.test', roleKey: 'super_admin' });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({ roleKey: 'You can only give new accounts the Employee role' });
    });

    it('is forbidden to managers and employees', async () => {
      const { body } = await newHire();
      expect((await as.manager.post('/employees', body)).status).toBe(403);
      expect((await as.employee.post('/employees', body)).status).toBe(403);
      await as.employee.get('/employees/form-options').expect(403);
    });
  });

  describe('update', () => {
    it('saves only real changes and records which fields changed', async () => {
      const res = await patch(as.hr_admin, `/employees/${ids.managersReport}`, { workLocation: 'Sylhet office', phone: '+8801700000001' });
      expect(res.status).toBe(200);
      const activity = (await as.hr_admin.get(`/employees/${ids.managersReport}/activity`).expect(200)).body.data;
      expect(activity[0]).toMatchObject({ action: 'employee.updated', changedFields: ['phone', 'workLocation'] });
      expect(JSON.stringify(activity)).not.toContain('+8801700000001');
    });

    it('refuses a reporting loop', async () => {
      const res = await patch(as.hr_admin, `/employees/${ids.manager}`, { managerId: ids.employee });
      expect(res.status).toBe(422);
      expect(res.body.errors.managerId).toMatch(/already reports/);
    });

    it('rejects fields that are not editable this way', async () => {
      expect((await patch(as.hr_admin, `/employees/${ids.employee}`, { status: 'INACTIVE' })).status).toBe(422);
    });

    it('forbids an employee from editing records, even their own', async () => {
      expect((await patch(as.employee, `/employees/${ids.employee}`, { firstName: 'Boss' })).status).toBe(403);
    });
  });

  describe('my profile', () => {
    it('lets people change their contact details', async () => {
      const res = await patch(as.employee, '/me/profile', { phone: '+8801755555555' });
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('+8801755555555');
    });

    it('rejects anything else', async () => {
      expect((await patch(as.employee, '/me/profile', { departmentId: ids.hr })).status).toBe(422);
    });
  });

  describe('deactivate, reactivate, delete', () => {
    it("deactivating ends the person's sessions, cancels pending leave and releases the days", async () => {
      const leaveType = await t.prisma.leaveType.create({ data: { name: 'Annual', code: 'ANNUAL', defaultDaysPerYear: 18 } });
      await t.prisma.leaveBalance.create({ data: { employeeId: ids.employee, leaveTypeId: leaveType.id, year: 2026, allocated: 18, pending: 3 } });
      await t.prisma.leaveRequest.create({
        data: { employeeId: ids.employee, leaveTypeId: leaveType.id, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-07'), days: 3, reason: 'Family' },
      });

      await as.employee.get('/auth/me').expect(200);
      const res = await as.hr_admin.post(`/employees/${ids.employee}/deactivate`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'INACTIVE', allowedActions: { reactivate: true, delete: true } });

      await as.employee.get('/auth/me').expect(401);
      expect(await t.prisma.leaveRequest.count({ where: { employeeId: ids.employee, status: 'PENDING' } })).toBe(0);
      const balance = await t.prisma.leaveBalance.findFirstOrThrow({ where: { employeeId: ids.employee, leaveTypeId: leaveType.id } });
      expect(Number(balance.pending)).toBe(0);
    });

    it('refuses to delete an active employee or yourself', async () => {
      expect((await del(as.super_admin, `/employees/${ids.manager}`)).status).toBe(409);
      const self = await codeToId('SX-001');
      expect((await as.super_admin.post(`/employees/${self}/deactivate`)).status).toBe(409);
    });

    it('deletes an inactive employee softly and frees their code', async () => {
      expect((await del(as.super_admin, `/employees/${ids.employee}`)).status).toBe(204);
      await as.hr_admin.get(`/employees/${ids.employee}`).expect(404);
      const row = await t.prisma.employee.findUniqueOrThrow({ where: { id: ids.employee } });
      expect(row.deletedAt).not.toBeNull();
      const unique = await as.hr_admin.get('/employees/check-unique?employeeCode=SX-004').expect(200);
      expect(unique.body.data.employeeCode.available).toBe(true);
    });
  });
});
