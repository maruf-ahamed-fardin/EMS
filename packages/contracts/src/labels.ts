import type { AttendanceStatus, BloodGroup, EmployeeStatus, EmploymentType, LeaveRequestStatus } from './enums';

/** Words for stored values, shared by the web app and the reports so both say the same thing. */

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive' };

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'On time',
  LATE: 'Late',
  ABSENT: 'Absent',
  ON_LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
  WEEKEND: 'Weekend',
};

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** B_POS reads as B+ on the card; the stored value stays an identifier Prisma accepts. */
export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
  O_POS: 'O+',
  O_NEG: 'O-',
};
