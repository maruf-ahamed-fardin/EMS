import type { EmployeeListQuery, EmployeeSort } from '@/lib/validations';
import type { Prisma } from '@/lib/db/generated/prisma/client';

/** A date-only column value (stored as UTC midnight) from `YYYY-MM-DD`. */
export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function fromDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Filters from the list query. Search matches every word against name, code or email, so
 * "rahim ahm" finds Rahim Ahmed. The trigram indexes keep these ILIKE lookups fast.
 */
export function employeeFilters(query: EmployeeListQuery): Prisma.EmployeeWhereInput {
  const and: Prisma.EmployeeWhereInput[] = [];

  const words = (query.q ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
  for (const word of words) {
    const contains = { contains: word, mode: 'insensitive' as const };
    and.push({ OR: [{ firstName: contains }, { lastName: contains }, { employeeCode: contains }, { email: contains }] });
  }

  if (query.departmentId) and.push({ departmentId: query.departmentId });
  if (query.positionId) and.push({ positionId: query.positionId });
  if (query.managerId) and.push({ managerId: query.managerId });
  if (query.status) and.push({ status: query.status });
  if (query.employmentType) and.push({ employmentType: query.employmentType });
  if (query.joinedFrom) and.push({ joiningDate: { gte: toDateOnly(query.joinedFrom) } });

  return and.length > 0 ? { AND: and } : {};
}

/** Sort keys are an allow-list (plan §6); the id tiebreak keeps pages stable. */
export function employeeOrderBy(sort: EmployeeSort): Prisma.EmployeeOrderByWithRelationInput[] {
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  switch (sort.replace(/^-/, '')) {
    case 'code':
      return [{ employeeCode: direction }, { id: 'asc' }];
    case 'joined':
      return [{ joiningDate: direction }, { id: 'asc' }];
    case 'created':
      return [{ createdAt: direction }, { id: 'asc' }];
    default:
      return [{ firstName: direction }, { lastName: direction }, { id: 'asc' }];
  }
}

export const EMPLOYEE_CODE_PREFIX = 'SX';

/** The next free code after the highest existing `SX-NNN`, keeping at least three digits. */
export function nextEmployeeCode(existingCodes: readonly string[], prefix = EMPLOYEE_CODE_PREFIX): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const code of existingCodes) {
    const match = pattern.exec(code);
    if (match?.[1]) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
}

/**
 * True when making `managerId` the manager of `employeeId` would create a loop: the employee is
 * already somewhere above that manager. `managerOf` answers one level at a time.
 */
export async function createsManagerCycle(
  employeeId: string,
  managerId: string,
  managerOf: (id: string) => Promise<string | null>,
  maxDepth = 50,
): Promise<boolean> {
  let current: string | null = managerId;
  for (let depth = 0; current && depth < maxDepth; depth++) {
    if (current === employeeId) return true;
    current = await managerOf(current);
  }
  return current !== null;
}

/** The calendar year in the organization's time zone (plan D6), for leave balances. */
export function organizationYear(now = new Date(), timeZone = 'Asia/Dhaka'): number {
  return Number(new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone }).format(now));
}
