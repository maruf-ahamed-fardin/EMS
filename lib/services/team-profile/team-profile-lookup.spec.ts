import type { PermissionMap } from '@/lib/validations';
import type { AuditService } from '@/lib/services/audit/audit.service';
import type { AuthContext } from '@/lib/auth/auth-context';
import type { DocumentStorage } from '@/lib/services/documents/storage/storage';
import type { PrismaService } from '@/lib/db/prisma';
import { type CardRow, LOOKUP_NAMESAKES_MAX, searchWhere, TeamProfileService } from './team-profile.service';

/**
 * Who may browse the directory and who may only look someone up. The rule the tests pin down:
 * without `team_profile.browse`, a search returns one name (one person, or the few who share it)
 * or nobody — never a list of different people.
 */
function person(code: string, firstName: string, lastName: string): CardRow {
  return {
    id: `01a0ae57-0000-7000-8000-000000000${code.slice(-3)}`,
    employeeCode: code,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}@demo.selorax.test`,
    phone: '+8801700000000',
    bloodGroup: null,
    workLocation: 'Remote',
    joiningDate: new Date('2025-01-01T00:00:00Z'),
    photoKey: null,
    department: { id: '01a0ae57-501d-704a-813c-e7f7eaff9647', name: 'Development' },
    position: { title: 'Software Engineer' },
    manager: null,
    teamProfile: null,
  };
}

const ANIKA_AKTER = person('SX-005', 'Anika', 'Akter');
const ANIKA_SARKAR = person('SX-017', 'Anika', 'Sarkar');

function auth(permissions: PermissionMap): AuthContext {
  return {
    sessionId: 's',
    user: { id: 'u', email: 'e@demo.selorax.test', name: 'E', employeeId: null, role: { id: 'r', key: 'employee', name: 'Employee' } },
    permissions,
  };
}

const EMPLOYEE = auth({ 'team_profile.view': 'ALL' });
const HR = auth({ 'team_profile.view': 'ALL', 'team_profile.browse': 'ALL' });
const QUERY = { page: 1, limit: 12 } as const;

function setup(opts: { exact?: CardRow | null; matches?: CardRow[]; all?: CardRow[] }) {
  const prisma = {
    employee: {
      findFirst: jest.fn().mockResolvedValue(opts.exact ?? null),
      findMany: jest.fn().mockResolvedValue(opts.matches ?? opts.all ?? []),
      count: jest.fn().mockResolvedValue((opts.all ?? []).length),
    },
  };
  const service = new TeamProfileService(prisma as unknown as PrismaService, {} as AuditService, {} as DocumentStorage);
  return { service, prisma };
}

describe('Team Profile lookup (no team_profile.browse)', () => {
  it('shows nobody until the viewer searches, and does not touch the table', async () => {
    const { service, prisma } = setup({ all: [ANIKA_AKTER, ANIKA_SARKAR] });
    const result = await service.list(EMPLOYEE, QUERY);
    expect(result).toMatchObject({ data: [], mode: 'lookup', ambiguous: false });
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('returns the one person an exact employee ID or email names', async () => {
    const { service, prisma } = setup({ exact: ANIKA_SARKAR });
    const result = await service.list(EMPLOYEE, { ...QUERY, q: 'sx-017' });
    expect(result.data.map((p) => p.employeeCode)).toEqual(['SX-017']);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('returns a name search only when it names exactly one person', async () => {
    const { service } = setup({ matches: [ANIKA_AKTER] });
    const result = await service.list(EMPLOYEE, { ...QUERY, q: 'anika akter' });
    expect(result.data.map((p) => p.fullName)).toEqual(['Anika Akter']);
    expect(result.meta.total).toBe(1);
  });

  it('shows everyone who shares the searched name, each with their own employee ID', async () => {
    const twin = { ...person('SX-031', 'Anika', 'Akter'), email: 'anika.akter2@demo.selorax.test' };
    const { service } = setup({ matches: [ANIKA_AKTER, twin] });
    const result = await service.list(EMPLOYEE, { ...QUERY, q: 'anika akter' });
    expect(result.data.map((p) => p.employeeCode)).toEqual(['SX-005', 'SX-031']);
    expect(result).toMatchObject({ mode: 'lookup', ambiguous: false });
    expect(result.meta.total).toBe(2);
  });

  it('treats case and extra spaces as the same name', async () => {
    const shouty = { ...person('SX-031', 'ANIKA', 'akter'), email: 'a2@demo.selorax.test' };
    const { service } = setup({ matches: [ANIKA_AKTER, shouty] });
    expect((await service.list(EMPLOYEE, { ...QUERY, q: 'anika akter' })).data).toHaveLength(2);
  });

  it('stops at the cap, so a very common name cannot list a crowd', async () => {
    const crowd = Array.from({ length: LOOKUP_NAMESAKES_MAX + 1 }, (_, i) =>
      person(`SX-${String(100 + i)}`, 'Anika', 'Akter'),
    );
    const { service } = setup({ matches: crowd });
    const result = await service.list(EMPLOYEE, { ...QUERY, q: 'anika akter' });
    expect(result).toMatchObject({ data: [], ambiguous: true });
  });

  it('returns nobody for a search that matches different names, and says so', async () => {
    const { service, prisma } = setup({ matches: [ANIKA_AKTER, ANIKA_SARKAR] });
    const result = await service.list(EMPLOYEE, { ...QUERY, q: 'a' });
    expect(result).toMatchObject({ data: [], mode: 'lookup', ambiguous: true });
    expect(result.meta.total).toBe(0);
    // It never asks for more than the cap plus one: enough to know, never enough to list
    expect(prisma.employee.findMany.mock.calls[0][0].take).toBe(LOOKUP_NAMESAKES_MAX + 1);
  });

  it('ignores filters, which would otherwise list a whole department', async () => {
    const { service, prisma } = setup({ all: [ANIKA_AKTER, ANIKA_SARKAR] });
    const result = await service.list(EMPLOYEE, { ...QUERY, departmentId: ANIKA_AKTER.department.id });
    expect(result.data).toEqual([]);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });
});

describe('Team Profile browse (team_profile.browse)', () => {
  it('pages through everyone without a search', async () => {
    const { service } = setup({ all: [ANIKA_AKTER, ANIKA_SARKAR] });
    const result = await service.list(HR, QUERY);
    expect(result).toMatchObject({ mode: 'browse', ambiguous: false });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
  });
});

describe('searchWhere', () => {
  it('requires every word to match, so a full name finds the person', () => {
    const where = searchWhere('  Anika   Akter ');
    expect(where.AND).toHaveLength(2);
  });
});
