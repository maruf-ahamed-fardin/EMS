import { employeeListQuery } from '@/lib/validations';
import {
  createsManagerCycle,
  employeeFilters,
  employeeOrderBy,
  fromDateOnly,
  nextEmployeeCode,
  organizationYear,
  toDateOnly,
} from '@/lib/services/employees/employee-query';
import { changedFields } from '@/lib/services/employees/employees.service';

describe('employeeFilters', () => {
  it('matches every search word against name, code or email', () => {
    const where = employeeFilters(employeeListQuery.parse({ q: '  rahim  ahm ' }));
    expect(where.AND).toHaveLength(2);
    expect(JSON.stringify(where)).toContain('"contains":"rahim","mode":"insensitive"');
    expect(JSON.stringify(where)).toContain('"employeeCode":{"contains":"ahm"');
  });

  it('adds only the filters that are set', () => {
    expect(employeeFilters(employeeListQuery.parse({}))).toEqual({});
    const where = employeeFilters(
      employeeListQuery.parse({ status: 'INACTIVE', joinedFrom: '2026-01-01', departmentId: '0192f0c3-0000-7000-8000-000000000001' }),
    );
    expect(where.AND).toEqual([
      { departmentId: '0192f0c3-0000-7000-8000-000000000001' },
      { status: 'INACTIVE' },
      { joiningDate: { gte: new Date('2026-01-01T00:00:00.000Z') } },
    ]);
  });
});

describe('employeeOrderBy', () => {
  it('sorts by name by default and always breaks ties by id', () => {
    expect(employeeOrderBy('name')).toEqual([{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }]);
    expect(employeeOrderBy('-joined')).toEqual([{ joiningDate: 'desc' }, { id: 'asc' }]);
  });
});

describe('nextEmployeeCode', () => {
  it('continues after the highest code, ignoring other patterns', () => {
    expect(nextEmployeeCode(['SX-001', 'SX-060', 'SX-007', 'TMP-999', 'SX-ABC'])).toBe('SX-061');
  });

  it('starts at 001 and grows past three digits', () => {
    expect(nextEmployeeCode([])).toBe('SX-001');
    expect(nextEmployeeCode(['SX-999'])).toBe('SX-1000');
  });
});

describe('createsManagerCycle', () => {
  // a ← b ← c  (c reports to b, b reports to a)
  const managers: Record<string, string | null> = { a: null, b: 'a', c: 'b' };
  const lookup = (id: string) => Promise.resolve(managers[id] ?? null);

  it('allows a manager from another branch or above', async () => {
    expect(await createsManagerCycle('c', 'a', lookup)).toBe(false);
  });

  it('refuses a loop, direct or indirect', async () => {
    expect(await createsManagerCycle('a', 'c', lookup)).toBe(true);
    expect(await createsManagerCycle('b', 'c', lookup)).toBe(true);
  });
});

describe('dates', () => {
  it('round-trips calendar days without shifting across time zones', () => {
    expect(fromDateOnly(toDateOnly('2026-03-01'))).toBe('2026-03-01');
  });

  it('uses the Dhaka calendar year, which turns before UTC', () => {
    expect(organizationYear(new Date('2026-12-31T19:00:00Z'))).toBe(2027);
    expect(organizationYear(new Date('2026-12-31T17:00:00Z'))).toBe(2026);
  });
});

describe('changedFields', () => {
  const row = {
    id: 'e1',
    employeeCode: 'SX-004',
    firstName: 'Rahim',
    lastName: 'Ahmed',
    email: 'rahim@demo.selorax.test',
    phone: '+8801700000000',
    dateOfBirth: new Date('1992-01-15T00:00:00Z'),
    gender: null,
    address: { line1: 'House 12', city: 'Dhaka', postcode: '1212', country: 'Bangladesh' },
    emergencyContact: { name: 'Karim', relationship: 'Brother', phone: '+8801800000000' },
    departmentId: 'd1',
    positionId: 'p1',
    managerId: null,
    joiningDate: new Date('2024-01-01T00:00:00Z'),
    employmentType: 'FULL_TIME' as const,
    workLocation: 'Dhaka office',
    status: 'ACTIVE' as const,
    user: null,
  };

  it('ignores values that are the same, including dates and reordered objects', () => {
    expect(
      changedFields(row, {
        firstName: 'Rahim',
        dateOfBirth: '1992-01-15',
        address: { country: 'Bangladesh', city: 'Dhaka', line1: 'House 12', postcode: '1212', line2: undefined },
      }),
    ).toEqual({});
  });

  it('keeps the fields that really change', () => {
    expect(changedFields(row, { phone: '+8801711111111', managerId: 'e9', lastName: 'Ahmed' })).toEqual({
      phone: '+8801711111111',
      managerId: 'e9',
    });
  });
});
