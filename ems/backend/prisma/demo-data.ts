import type { SystemRoleKey } from '@ems/contracts';
import type { PrismaClient } from '../src/generated/prisma/client';

/** Every demo address uses this reserved domain, so demo accounts can't be mistaken for real ones. */
export const DEMO_DOMAIN = 'demo.selorax.test';

export const DEMO_PEOPLE: Record<SystemRoleKey, { code: string; firstName: string; lastName: string; email: string; title: string }> = {
  super_admin: { code: 'SX-001', firstName: 'Nusrat', lastName: 'Jahan', email: `superadmin@${DEMO_DOMAIN}`, title: 'Chief Operating Officer' },
  hr_admin: { code: 'SX-002', firstName: 'Farhana', lastName: 'Akter', email: `hr@${DEMO_DOMAIN}`, title: 'HR Manager' },
  manager: { code: 'SX-003', firstName: 'Tanvir', lastName: 'Hasan', email: `manager@${DEMO_DOMAIN}`, title: 'Engineering Manager' },
  employee: { code: 'SX-004', firstName: 'Rahim', lastName: 'Ahmed', email: `employee@${DEMO_DOMAIN}`, title: 'Software Engineer' },
};

/**
 * One demo user per system role, each linked to an employee. The employee reports to the manager, so
 * TEAM scope has something to reach. Idempotent: running it again resets the demo passwords.
 * Phase 3+ extends this with the fuller data set in plan §14.
 */
export async function seedDemoUsers(prisma: PrismaClient, passwordHash: string) {
  const roles = new Map((await prisma.role.findMany({ select: { id: true, key: true } })).map((r) => [r.key, r.id]));

  const department = await upsertDepartment(prisma, 'Development', 'DEV');
  const management = await upsertDepartment(prisma, 'Management', 'MGT');
  const people = await upsertDepartment(prisma, 'Human Resources', 'HR');
  const departmentFor: Record<SystemRoleKey, string> = {
    super_admin: management,
    hr_admin: people,
    manager: department,
    employee: department,
  };

  const employeeIds = {} as Record<SystemRoleKey, string>;
  for (const roleKey of ['super_admin', 'hr_admin', 'manager', 'employee'] as const) {
    const person = DEMO_PEOPLE[roleKey];
    const departmentId = departmentFor[roleKey];
    const position =
      (await prisma.position.findFirst({ where: { title: person.title, departmentId, deletedAt: null }, select: { id: true } })) ??
      (await prisma.position.create({ data: { title: person.title, departmentId }, select: { id: true } }));

    const data = {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: '+8801700000000',
      dateOfBirth: new Date('1992-01-15'),
      address: { line1: 'House 12, Road 5', city: 'Dhaka', postcode: '1212', country: 'Bangladesh' },
      emergencyContact: { name: 'Demo Contact', relationship: 'Sibling', phone: '+8801800000000' },
      departmentId,
      positionId: position.id,
      managerId: roleKey === 'employee' ? employeeIds.manager : null,
      joiningDate: new Date('2024-01-01'),
      employmentType: 'FULL_TIME' as const,
      workLocation: 'Dhaka office',
    };
    const existing = await prisma.employee.findFirst({ where: { employeeCode: person.code, deletedAt: null }, select: { id: true } });
    const employee = existing
      ? await prisma.employee.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.employee.create({ data: { employeeCode: person.code, ...data }, select: { id: true } });
    employeeIds[roleKey] = employee.id;

    const roleId = roles.get(roleKey);
    if (!roleId) throw new Error(`Role ${roleKey} is missing; run the catalogue sync first`);
    await prisma.user.upsert({
      where: { email: person.email },
      create: { email: person.email, passwordHash, roleId, employeeId: employee.id },
      update: { passwordHash, roleId, employeeId: employee.id, status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
    });
  }

  await prisma.department.update({ where: { id: department }, data: { headEmployeeId: employeeIds.manager } });
  return employeeIds;
}

async function upsertDepartment(prisma: PrismaClient, name: string, code: string): Promise<string> {
  const existing = await prisma.department.findFirst({ where: { code, deletedAt: null }, select: { id: true } });
  if (existing) return existing.id;
  return (await prisma.department.create({ data: { name, code }, select: { id: true } })).id;
}
