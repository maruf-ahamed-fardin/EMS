import type { DepartmentDetail, DepartmentListItem, PositionListItem } from '@/lib/validations';
import { DEMO_PEOPLE } from '@/prisma/demo-data';
import { describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

let ip = 0;
const nextIp = () => `198.18.1.${(ip = (ip % 250) + 1)}`;

describeWithDatabase('departments and positions', () => {
  let t: TestApp;
  const as = {} as Record<keyof typeof DEMO_PEOPLE, TestBrowser>;
  let dev: DepartmentListItem;

  beforeAll(async () => {
    t = await startTestApp();
    for (const role of Object.keys(DEMO_PEOPLE) as Array<keyof typeof DEMO_PEOPLE>) {
      as[role] = new TestBrowser(t.app, nextIp());
      expect((await as[role].login(DEMO_PEOPLE[role].email)).status).toBe(200);
    }
    const list = (await as.hr_admin.get('/departments').expect(200)).body.data as DepartmentListItem[];
    dev = list.find((d) => d.code === 'DEV')!;
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  describe('reading', () => {
    it('lists departments with head and live counts', async () => {
      const list = (await as.employee.get('/departments').expect(200)).body.data as DepartmentListItem[];
      expect(list.map((d) => d.code)).toEqual(['DEV', 'FIN', 'HR', 'MKT', 'SAL']);
      const activeInDev = await t.prisma.employee.count({ where: { department: { code: 'DEV' }, status: 'ACTIVE', deletedAt: null } });
      expect(dev).toMatchObject({ name: 'Development', head: { name: 'Tanvir Hasan' }, activeEmployeeCount: activeInDev, positionCount: 4 });
    });

    it('shows a department with its positions and what the viewer may do', async () => {
      const hr = (await as.hr_admin.get(`/departments/${dev.id}`).expect(200)).body.data as DepartmentDetail;
      expect(hr.positions.map((p) => p.title)).toContain('QA Engineer');
      expect(hr.allowedActions).toEqual({ update: true, delete: false, managePositions: true });

      const employee = (await as.employee.get(`/departments/${dev.id}`).expect(200)).body.data as DepartmentDetail;
      expect(employee.allowedActions).toEqual({ update: false, delete: false, managePositions: false });
    });

    it('answers 404 for an unknown department', async () => {
      await as.hr_admin.get('/departments/0192f0c3-0000-7000-8000-000000000000').expect(404);
      await as.hr_admin.get('/departments/nope').expect(404);
    });

    it('offers only active employees as heads, and only to people who can edit departments', async () => {
      const options = (await as.hr_admin.get('/departments/head-options').expect(200)).body.data as Array<{ employeeCode: string }>;
      expect(options.map((o) => o.employeeCode)).not.toContain('SX-042');
      await as.manager.get('/departments/head-options').expect(403);
    });
  });

  describe('departments', () => {
    it('creates a department, refusing a duplicate name or code', async () => {
      const created = await as.hr_admin.post('/departments', { name: 'Customer Support', code: 'sup', description: 'Helps merchants' });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ code: 'SUP', activeEmployeeCount: 0, allowedActions: { delete: true } });

      const duplicate = await as.hr_admin.post('/departments', { name: 'customer support', code: 'DEV' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.errors).toEqual({
        name: 'Another department already has this name',
        code: 'Another department already uses this code',
      });
    });

    it('refuses an inactive employee as head', async () => {
      const inactive = await t.prisma.employee.findFirstOrThrow({ where: { employeeCode: 'SX-042' } });
      const res = await as.hr_admin.patch(`/departments/${dev.id}`, { headEmployeeId: inactive.id });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({ headEmployeeId: 'Choose an active employee as head' });
    });

    it('refuses to delete a department with active employees, and says how many', async () => {
      const res = await as.super_admin.delete(`/departments/${dev.id}`);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe(`Development still has ${dev.activeEmployeeCount} active employees. Move them to another department first.`);
    });

    it('refuses to deactivate a department people still work in', async () => {
      const res = await as.hr_admin.patch(`/departments/${dev.id}`, { isActive: false });
      expect(res.status).toBe(409);
    });

    it('deletes an empty department with its positions, and new hires can no longer pick it', async () => {
      const dept = (await as.hr_admin.post('/departments', { name: 'Research', code: 'RND' })).body.data as DepartmentDetail;
      const position = (await as.hr_admin.post('/positions', { title: 'Researcher', departmentId: dept.id })).body.data as PositionListItem;

      expect((await as.super_admin.delete(`/departments/${dept.id}`)).status).toBe(204);
      await as.hr_admin.get(`/departments/${dept.id}`).expect(404);
      expect((await t.prisma.position.findUniqueOrThrow({ where: { id: position.id } })).deletedAt).not.toBeNull();

      const options = (await as.hr_admin.get('/employees/form-options').expect(200)).body.data;
      expect(options.departments.map((d: { code: string }) => d.code)).not.toContain('RND');
      expect(await t.prisma.auditLog.count({ where: { action: 'department.deleted', entityId: dept.id } })).toBe(1);

      // The code is free again
      expect((await as.hr_admin.post('/departments', { name: 'Research', code: 'RND' })).status).toBe(201);
    });

    it('is read-only for managers and employees', async () => {
      expect((await as.manager.post('/departments', { name: 'X', code: 'XX' })).status).toBe(403);
      expect((await as.employee.patch(`/departments/${dev.id}`, { name: 'Mine' })).status).toBe(403);
      expect((await as.hr_admin.delete(`/departments/${dev.id}`)).status).toBe(409);
    });
  });

  describe('positions', () => {
    it('lists positions by department with holder counts', async () => {
      const list = (await as.employee.get(`/positions?departmentId=${dev.id}`).expect(200)).body.data as PositionListItem[];
      expect(list.every((p) => p.department?.id === dev.id)).toBe(true);
      expect(list.reduce((sum, p) => sum + p.activeEmployeeCount, 0)).toBe(dev.activeEmployeeCount);
    });

    it('refuses a duplicate title in the same department, including shared positions', async () => {
      expect((await as.hr_admin.post('/positions', { title: 'qa engineer', departmentId: dev.id })).status).toBe(409);
      expect((await as.hr_admin.post('/positions', { title: 'Intern', departmentId: null })).status).toBe(201);
      const again = await as.hr_admin.post('/positions', { title: 'Intern', departmentId: null });
      expect(again.status).toBe(409);
      expect(again.body.errors).toEqual({ title: 'A shared position with this title already exists' });
    });

    it('protects positions that people hold', async () => {
      const held = (await as.hr_admin.get(`/positions?departmentId=${dev.id}`)).body.data.find((p: PositionListItem) => p.activeEmployeeCount > 0) as PositionListItem;
      const other = (await as.hr_admin.get('/departments')).body.data.find((d: DepartmentListItem) => d.code === 'SAL') as DepartmentListItem;

      const del = await as.hr_admin.delete(`/positions/${held.id}`);
      expect(del.status).toBe(409);
      expect(del.body.message).toMatch(new RegExp(`^${held.activeEmployeeCount} active employees? hold`));

      expect((await as.hr_admin.patch(`/positions/${held.id}`, { departmentId: other.id })).status).toBe(409);
      expect((await as.hr_admin.patch(`/positions/${held.id}`, { isActive: false })).status).toBe(409);
    });

    it('renames and deletes an unused position', async () => {
      const created = (await as.hr_admin.post('/positions', { title: 'Data Analyst', departmentId: dev.id, level: 'L2' })).body.data as PositionListItem;
      const renamed = await as.hr_admin.patch(`/positions/${created.id}`, { title: 'Senior Data Analyst', level: 'L3' });
      expect(renamed.body.data).toMatchObject({ title: 'Senior Data Analyst', level: 'L3' });
      expect((await as.hr_admin.delete(`/positions/${created.id}`)).status).toBe(204);
    });

    it('is managed only with position.manage', async () => {
      expect((await as.manager.post('/positions', { title: 'Lead', departmentId: dev.id })).status).toBe(403);
    });
  });
});
