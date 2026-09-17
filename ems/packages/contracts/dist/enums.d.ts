/**
 * Enum values shared by the database (Prisma enums use the same strings), the API and the UI.
 * The backend's contract test fails if a value here and in `schema.prisma` drift apart.
 */
export declare const UserStatus: readonly ["ACTIVE", "INACTIVE", "LOCKED"];
export type UserStatus = (typeof UserStatus)[number];
export declare const EmploymentType: readonly ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
export type EmploymentType = (typeof EmploymentType)[number];
export declare const EmployeeStatus: readonly ["ACTIVE", "INACTIVE"];
export type EmployeeStatus = (typeof EmployeeStatus)[number];
export declare const Gender: readonly ["FEMALE", "MALE", "OTHER", "UNDISCLOSED"];
export type Gender = (typeof Gender)[number];
export declare const PermissionScope: readonly ["OWN", "TEAM", "ALL"];
export type PermissionScope = (typeof PermissionScope)[number];
export declare const AttendanceStatus: readonly ["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKEND"];
export type AttendanceStatus = (typeof AttendanceStatus)[number];
export declare const AttendanceRecordType: readonly ["CHECK_IN", "CHECK_OUT"];
export type AttendanceRecordType = (typeof AttendanceRecordType)[number];
/** Where a punch came from. Devices added later (plan §1 extension points) reuse this. */
export declare const AttendanceSource: readonly ["WEB", "MOBILE", "BIOMETRIC", "RFID", "API", "ADMIN"];
export type AttendanceSource = (typeof AttendanceSource)[number];
export declare const LeaveRequestStatus: readonly ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
export type LeaveRequestStatus = (typeof LeaveRequestStatus)[number];
export declare const ALL_ENUMS: {
    readonly UserStatus: readonly ["ACTIVE", "INACTIVE", "LOCKED"];
    readonly EmploymentType: readonly ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
    readonly EmployeeStatus: readonly ["ACTIVE", "INACTIVE"];
    readonly Gender: readonly ["FEMALE", "MALE", "OTHER", "UNDISCLOSED"];
    readonly PermissionScope: readonly ["OWN", "TEAM", "ALL"];
    readonly AttendanceStatus: readonly ["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKEND"];
    readonly AttendanceRecordType: readonly ["CHECK_IN", "CHECK_OUT"];
    readonly AttendanceSource: readonly ["WEB", "MOBILE", "BIOMETRIC", "RFID", "API", "ADMIN"];
    readonly LeaveRequestStatus: readonly ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
};
//# sourceMappingURL=enums.d.ts.map