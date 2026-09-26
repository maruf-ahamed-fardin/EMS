import type { SystemRoleKey } from '@/lib/validations';
import type { PrismaClient } from '@/lib/db/generated/prisma/client';

/** Every demo address uses this reserved domain, so demo accounts can't be mistaken for real ones. */
export const DEMO_DOMAIN = 'demo.selorax.test';

const DEPARTMENTS = [
  { code: 'DEV', name: 'Development', description: 'Builds and runs the SeloraX platform.', positions: ['Engineering Manager', 'Senior Software Engineer', 'Software Engineer', 'QA Engineer'] },
  { code: 'MKT', name: 'Marketing', description: 'Brand, content and campaigns.', positions: ['Marketing Lead', 'Content Strategist', 'Designer'] },
  { code: 'HR', name: 'Human Resources', description: 'Hiring, people operations and payroll support.', positions: ['Head of People', 'HR Manager', 'HR Executive'] },
  { code: 'FIN', name: 'Finance', description: 'Accounts, budgeting and reporting.', positions: ['Finance Lead', 'Accountant'] },
  { code: 'SAL', name: 'Sales', description: 'Merchant acquisition and accounts.', positions: ['Sales Lead', 'Account Executive'] },
] as const;

type DepartmentCode = (typeof DEPARTMENTS)[number]['code'];

/** The four sign-in accounts. Codes SX-001..004; everyone else is generated after them. */
export const DEMO_PEOPLE: Record<
  SystemRoleKey,
  { code: string; firstName: string; lastName: string; email: string; department: DepartmentCode; title: string }
> = {
  super_admin: { code: 'SX-001', firstName: 'Nusrat', lastName: 'Jahan', email: `superadmin@${DEMO_DOMAIN}`, department: 'HR', title: 'Head of People' },
  hr_admin: { code: 'SX-002', firstName: 'Farhana', lastName: 'Akter', email: `hr@${DEMO_DOMAIN}`, department: 'HR', title: 'HR Manager' },
  manager: { code: 'SX-003', firstName: 'Tanvir', lastName: 'Hasan', email: `manager@${DEMO_DOMAIN}`, department: 'DEV', title: 'Engineering Manager' },
  employee: { code: 'SX-004', firstName: 'Rahim', lastName: 'Ahmed', email: `employee@${DEMO_DOMAIN}`, department: 'DEV', title: 'Software Engineer' },
};

const FIRST_NAMES = [
  'Arif', 'Sadia', 'Imran', 'Nabila', 'Rakib', 'Tahmina', 'Mahmud', 'Sumaiya', 'Fahim', 'Jannatul', 'Shakil', 'Mehjabin',
  'Rafiq', 'Lamia', 'Sabbir', 'Farzana', 'Tanjim', 'Ayesha', 'Nayeem', 'Rumana', 'Habib', 'Sharmin', 'Kamrul', 'Nusrat',
  'Asif', 'Tasnim', 'Mizan', 'Sabrina', 'Zahid', 'Anika',
];
const LAST_NAMES = [
  'Chowdhury', 'Rahman', 'Hossain', 'Islam', 'Karim', 'Sultana', 'Ahmed', 'Begum', 'Uddin', 'Khan', 'Sarkar', 'Talukder',
  'Mia', 'Akter', 'Siddique', 'Haque', 'Bhuiyan', 'Mollah', 'Das', 'Roy',
];
const CITIES = ['Dhaka', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi'];
const RELATIONSHIPS = ['Sister', 'Brother', 'Mother', 'Father', 'Spouse'];

/** Share of the generated employees per department (sums to 56). */
const HEADCOUNT: Record<DepartmentCode, number> = { DEV: 20, MKT: 10, HR: 6, FIN: 8, SAL: 12 };

/** Small deterministic PRNG, so the demo data is the same on every machine and every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days: number, from = new Date('2026-09-17T00:00:00Z')): Date {
  return new Date(from.getTime() - days * 86_400_000);
}

/**
 * The demo organization (plan §14): 5 departments, 14 positions, 60 employees with managers and
 * joining dates spread over three years, plus one sign-in account per system role.
 * Idempotent: rows are matched by code, and running it again resets the demo passwords.
 * Attendance, leave and documents join the seed in their phases.
 */
export async function seedDemoData(prisma: PrismaClient, passwordHash: string) {
  const random = mulberry32(2026);
  const pickFrom = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

  const departmentIds = {} as Record<DepartmentCode, string>;
  const positionIds = new Map<string, string>();
  for (const department of DEPARTMENTS) {
    const existing = await prisma.department.findFirst({ where: { code: department.code, deletedAt: null }, select: { id: true } });
    const row = existing
      ? await prisma.department.update({ where: { id: existing.id }, data: { description: department.description }, select: { id: true } })
      : await prisma.department.create({ data: { code: department.code, name: department.name, description: department.description }, select: { id: true } });
    departmentIds[department.code] = row.id;
    for (const title of department.positions) {
      const position =
        (await prisma.position.findFirst({ where: { title, departmentId: row.id, deletedAt: null }, select: { id: true } })) ??
        (await prisma.position.create({ data: { title, departmentId: row.id }, select: { id: true } }));
      positionIds.set(`${department.code}:${title}`, position.id);
    }
  }

  async function upsertEmployee(person: {
    code: string;
    firstName: string;
    lastName: string;
    email: string;
    department: DepartmentCode;
    title: string;
    managerId: string | null;
    joinedDaysAgo: number;
    status?: 'ACTIVE' | 'INACTIVE';
    employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  }): Promise<string> {
    const city = pickFrom(CITIES);
    const data = {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: `+88017${String(Math.floor(random() * 1e8)).padStart(8, '0')}`,
      dateOfBirth: isoDaysAgo(365 * (23 + Math.floor(random() * 20)) + Math.floor(random() * 365)),
      gender: random() < 0.5 ? ('FEMALE' as const) : ('MALE' as const),
      address: { line1: `House ${1 + Math.floor(random() * 90)}, Road ${1 + Math.floor(random() * 20)}`, city, postcode: '1212', country: 'Bangladesh' },
      emergencyContact: { name: `${pickFrom(FIRST_NAMES)} ${person.lastName}`, relationship: pickFrom(RELATIONSHIPS), phone: `+88018${String(Math.floor(random() * 1e8)).padStart(8, '0')}` },
      departmentId: departmentIds[person.department],
      positionId: positionIds.get(`${person.department}:${person.title}`)!,
      managerId: person.managerId,
      joiningDate: isoDaysAgo(person.joinedDaysAgo),
      employmentType: person.employmentType ?? ('FULL_TIME' as const),
      workLocation: city === 'Dhaka' ? 'Dhaka office' : 'Remote',
      status: person.status ?? ('ACTIVE' as const),
      deactivatedAt: person.status === 'INACTIVE' ? isoDaysAgo(20) : null,
    };
    const existing = await prisma.employee.findFirst({ where: { employeeCode: person.code, deletedAt: null }, select: { id: true } });
    const row = existing
      ? await prisma.employee.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.employee.create({ data: { employeeCode: person.code, ...data }, select: { id: true } });
    return row.id;
  }

  // Sign-in accounts first: the Head of People leads HR, the manager leads Development
  const accountIds = {} as Record<SystemRoleKey, string>;
  accountIds.super_admin = await upsertEmployee({ ...DEMO_PEOPLE.super_admin, managerId: null, joinedDaysAgo: 1000 });
  accountIds.hr_admin = await upsertEmployee({ ...DEMO_PEOPLE.hr_admin, managerId: accountIds.super_admin, joinedDaysAgo: 900 });
  accountIds.manager = await upsertEmployee({ ...DEMO_PEOPLE.manager, managerId: null, joinedDaysAgo: 950 });
  accountIds.employee = await upsertEmployee({ ...DEMO_PEOPLE.employee, managerId: accountIds.manager, joinedDaysAgo: 400 });

  const heads: Record<DepartmentCode, string> = {
    DEV: accountIds.manager,
    HR: accountIds.super_admin,
    MKT: '',
    FIN: '',
    SAL: '',
  };

  let number = 5;
  for (const department of DEPARTMENTS) {
    for (let i = 0; i < HEADCOUNT[department.code]; i++) {
      const code = `SX-${String(number++).padStart(3, '0')}`;
      const firstName = pickFrom(FIRST_NAMES);
      const lastName = pickFrom(LAST_NAMES);
      const leadsDepartment = !heads[department.code];
      // The first title in each department is its lead; everyone else takes one of the others
      const title = leadsDepartment ? department.positions[0] : pickFrom(department.positions.slice(1));
      const id = await upsertEmployee({
        code,
        firstName,
        lastName,
        email: `${firstName}.${lastName}.${code}@${DEMO_DOMAIN}`.toLowerCase(),
        department: department.code,
        title,
        managerId: leadsDepartment ? null : heads[department.code],
        joinedDaysAgo: 5 + Math.floor(random() * 1090),
        status: code === 'SX-042' ? 'INACTIVE' : 'ACTIVE',
        employmentType: random() < 0.08 ? 'INTERN' : random() < 0.1 ? 'CONTRACT' : 'FULL_TIME',
      });
      if (leadsDepartment) heads[department.code] = id;
    }
  }

  for (const department of DEPARTMENTS) {
    await prisma.department.update({ where: { id: departmentIds[department.code] }, data: { headEmployeeId: heads[department.code] } });
  }

  const roles = new Map((await prisma.role.findMany({ select: { id: true, key: true } })).map((r) => [r.key, r.id]));
  for (const roleKey of Object.keys(DEMO_PEOPLE) as SystemRoleKey[]) {
    const roleId = roles.get(roleKey);
    if (!roleId) throw new Error(`Role ${roleKey} is missing; run the catalogue sync first`);
    const email = DEMO_PEOPLE[roleKey].email;
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, roleId, employeeId: accountIds[roleKey] },
      update: { passwordHash, roleId, employeeId: accountIds[roleKey], status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
    });
  }

  return { accountEmployeeIds: accountIds, departmentIds, employeeCount: number - 1 };
}

