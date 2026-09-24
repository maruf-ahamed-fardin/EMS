/**
 * Enum values shared by the database (Prisma enums use the same strings), the API and the UI.
 * The backend's contract test fails if a value here and in `schema.prisma` drift apart.
 */
export const UserStatus = ['ACTIVE', 'INACTIVE', 'LOCKED'] as const;
export type UserStatus = (typeof UserStatus)[number];

export const EmploymentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const;
export type EmploymentType = (typeof EmploymentType)[number];

export const EmployeeStatus = ['ACTIVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof EmployeeStatus)[number];

export const Gender = ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'] as const;
export type Gender = (typeof Gender)[number];

export const PermissionScope = ['OWN', 'TEAM', 'ALL'] as const;
export type PermissionScope = (typeof PermissionScope)[number];

export const AttendanceStatus = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'] as const;
export type AttendanceStatus = (typeof AttendanceStatus)[number];

export const AttendanceRecordType = ['CHECK_IN', 'CHECK_OUT'] as const;
export type AttendanceRecordType = (typeof AttendanceRecordType)[number];

/** Where a punch came from. Devices added later (plan §1 extension points) reuse this. */
export const AttendanceSource = ['WEB', 'MOBILE', 'BIOMETRIC', 'RFID', 'API', 'ADMIN'] as const;
export type AttendanceSource = (typeof AttendanceSource)[number];

export const LeaveRequestStatus = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type LeaveRequestStatus = (typeof LeaveRequestStatus)[number];

/**
 * Blood group, shown on the Team Profile card. `POS`/`NEG` rather than +/- because Prisma enum
 * values must be identifiers; `BLOOD_GROUP_LABELS` renders them as B+ and so on.
 */
export const BloodGroup = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
] as const;
export type BloodGroup = (typeof BloodGroup)[number];

export const ALL_ENUMS = {
  UserStatus,
  EmploymentType,
  EmployeeStatus,
  Gender,
  PermissionScope,
  AttendanceStatus,
  AttendanceRecordType,
  AttendanceSource,
  LeaveRequestStatus,
  BloodGroup,
} as const;
