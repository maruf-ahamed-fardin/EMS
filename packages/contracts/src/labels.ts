import type { AttendanceStatus, EmployeeStatus, EmploymentType, LeaveRequestStatus } from './enums';

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
