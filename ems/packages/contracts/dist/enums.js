"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ENUMS = exports.LeaveRequestStatus = exports.AttendanceSource = exports.AttendanceRecordType = exports.AttendanceStatus = exports.PermissionScope = exports.Gender = exports.EmployeeStatus = exports.EmploymentType = exports.UserStatus = void 0;
/**
 * Enum values shared by the database (Prisma enums use the same strings), the API and the UI.
 * The backend's contract test fails if a value here and in `schema.prisma` drift apart.
 */
exports.UserStatus = ['ACTIVE', 'INACTIVE', 'LOCKED'];
exports.EmploymentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
exports.EmployeeStatus = ['ACTIVE', 'INACTIVE'];
exports.Gender = ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'];
exports.PermissionScope = ['OWN', 'TEAM', 'ALL'];
exports.AttendanceStatus = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'];
exports.AttendanceRecordType = ['CHECK_IN', 'CHECK_OUT'];
/** Where a punch came from. Devices added later (plan §1 extension points) reuse this. */
exports.AttendanceSource = ['WEB', 'MOBILE', 'BIOMETRIC', 'RFID', 'API', 'ADMIN'];
exports.LeaveRequestStatus = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
exports.ALL_ENUMS = {
    UserStatus: exports.UserStatus,
    EmploymentType: exports.EmploymentType,
    EmployeeStatus: exports.EmployeeStatus,
    Gender: exports.Gender,
    PermissionScope: exports.PermissionScope,
    AttendanceStatus: exports.AttendanceStatus,
    AttendanceRecordType: exports.AttendanceRecordType,
    AttendanceSource: exports.AttendanceSource,
    LeaveRequestStatus: exports.LeaveRequestStatus,
};
//# sourceMappingURL=enums.js.map