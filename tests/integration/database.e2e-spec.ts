import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/db/generated/prisma/client';

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

/**
 * Applies every migration to a clean database and checks the constraints Prisma can't model.
 * Destructive: the database is reset, so its name must contain "test".
 */
describeDb('database migrations', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    if (!url || !new URL(url).pathname.includes('test')) {
      throw new Error('TEST_DATABASE_URL must name a database containing "test"; it is wiped');
    }
    const cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
    execFileSync(process.execPath, [cli, 'migrate', 'reset', '--force'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function makeEmployee(suffix: string) {
    const department = await prisma.department.create({ data: { name: `Dept ${suffix}`, code: `D${suffix}` } });
    const position = await prisma.position.create({ data: { title: 'Engineer', departmentId: department.id } });
    return prisma.employee.create({
      data: {
        employeeCode: `SX-${suffix}`,
        firstName: 'Rahim',
        lastName: 'Ahmed',
        email: `rahim.${suffix}@demo.selorax.test`,
        phone: '+8801700000000',
        dateOfBirth: new Date('1994-03-01'),
        address: { line1: 'House 1', city: 'Dhaka', postcode: '1212', country: 'BD' },
        emergencyContact: { name: 'Karim Ahmed', relationship: 'Brother', phone: '+8801800000000' },
        departmentId: department.id,
        positionId: position.id,
        joiningDate: new Date('2024-01-01'),
        employmentType: 'FULL_TIME',
        workLocation: 'Dhaka HQ',
      },
    });
  }

  it('treats emails as case-insensitive', async () => {
    const employee = await makeEmployee('100');
    await expect(
      prisma.employee.create({
        data: { ...stripIds(employee), employeeCode: 'SX-101', email: employee.email.toUpperCase() },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('lets a soft-deleted employee code be reused', async () => {
    const employee = await makeEmployee('200');
    await prisma.employee.update({ where: { id: employee.id }, data: { deletedAt: new Date() } });
    await expect(
      prisma.employee.create({ data: { ...stripIds(employee), email: 'other.200@demo.selorax.test' } }),
    ).resolves.toMatchObject({ employeeCode: 'SX-200' });
  });

  it('refuses a leave balance that is overdrawn', async () => {
    const employee = await makeEmployee('300');
    const leaveType = await prisma.leaveType.create({ data: { name: 'Annual', code: 'ANNUAL', defaultDaysPerYear: 18 } });
    await expect(
      prisma.leaveBalance.create({
        data: { employeeId: employee.id, leaveTypeId: leaveType.id, year: 2026, allocated: 5, used: 4, pending: 2 },
      }),
    ).rejects.toThrow(/leave_balances_not_overdrawn/);
  });

  it('refuses a leave request that ends before it starts', async () => {
    const employee = await makeEmployee('400');
    const leaveType = await prisma.leaveType.create({ data: { name: 'Sick', code: 'SICK', defaultDaysPerYear: 14 } });
    await expect(
      prisma.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate: new Date('2026-10-05'),
          endDate: new Date('2026-10-01'),
          days: 1,
          reason: 'Flu',
        },
      }),
    ).rejects.toThrow(/leave_requests_dates_ordered/);
  });
});

function stripIds<T extends { id: string; createdAt: Date; updatedAt: Date }>(row: T) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = row;
  return rest as Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { address: object; emergencyContact: object };
}
