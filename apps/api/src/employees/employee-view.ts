import type {
  Address,
  EmergencyContact,
  EmployeeDetail,
  EmployeeListItem,
} from '@ems/contracts';
import type { Prisma } from '../generated/prisma/client';
import { fromDateOnly } from './employee-query';

/**
 * Explicit selects (plan §12): only these columns ever leave the database for employee responses,
 * so a new column can't leak by default. `photoKey` is deliberately absent.
 */
export const EMPLOYEE_LIST_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  employmentType: true,
  status: true,
  joiningDate: true,
  workLocation: true,
  managerId: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmployeeSelect;

export const EMPLOYEE_DETAIL_SELECT = {
  ...EMPLOYEE_LIST_SELECT,
  phone: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  emergencyContact: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { directReports: { where: { deletedAt: null } } } },
  user: {
    select: {
      id: true,
      email: true,
      status: true,
      lastLoginAt: true,
      role: { select: { key: true, name: true } },
    },
  },
} satisfies Prisma.EmployeeSelect;

type ListRow = Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_LIST_SELECT }>;
type DetailRow = Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_DETAIL_SELECT }>;

export function toListItem(row: ListRow): EmployeeListItem {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: `${row.firstName} ${row.lastName}`,
    email: row.email,
    department: { id: row.department.id, name: row.department.name },
    position: { id: row.position.id, title: row.position.title },
    manager: row.manager ? { id: row.manager.id, name: `${row.manager.firstName} ${row.manager.lastName}` } : null,
    employmentType: row.employmentType,
    status: row.status,
    joiningDate: fromDateOnly(row.joiningDate),
    workLocation: row.workLocation,
  };
}

export interface DetailVisibility {
  showPrivate: boolean;
  showAccount: boolean;
  allowedActions: EmployeeDetail['allowedActions'];
}

export function toDetail(row: DetailRow, visibility: DetailVisibility): EmployeeDetail {
  return {
    ...toListItem(row),
    phone: row.phone,
    gender: row.gender,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    directReportCount: row._count.directReports,
    private: visibility.showPrivate
      ? {
          dateOfBirth: fromDateOnly(row.dateOfBirth),
          address: row.address as unknown as Address,
          emergencyContact: row.emergencyContact as unknown as EmergencyContact,
        }
      : null,
    account:
      visibility.showAccount && row.user
        ? {
            id: row.user.id,
            email: row.user.email,
            status: row.user.status,
            role: row.user.role,
            lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
          }
        : null,
    allowedActions: visibility.allowedActions,
  };
}
