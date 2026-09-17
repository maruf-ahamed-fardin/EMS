"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROLE_GRANTS = exports.SYSTEM_ROLES = void 0;
const permissions_1 = require("./permissions");
exports.SYSTEM_ROLES = {
    super_admin: { name: 'Super Admin', description: 'Full access, including roles and security settings' },
    hr_admin: { name: 'HR / Admin', description: 'Runs day-to-day HR for the whole organization' },
    manager: { name: 'Manager', description: 'Sees and approves for their direct reports' },
    employee: { name: 'Employee', description: 'Sees their own records' },
};
const allOf = (keys) => Object.fromEntries(keys.map((key) => [key, 'ALL']));
/**
 * The default permission matrix (plan §4). It is seeded once and then edited in
 * Roles & Permissions, so at runtime the database is the source of truth, not this object.
 * Permissions that have no meaningful reach (such as `attendance.self`) are granted as ALL.
 */
exports.DEFAULT_ROLE_GRANTS = {
    super_admin: allOf(permissions_1.PERMISSION_KEYS),
    hr_admin: allOf(permissions_1.PERMISSION_KEYS.filter((key) => key !== 'user.manage' && key !== 'role.manage')),
    manager: {
        'employee.view': 'TEAM',
        'department.view': 'ALL',
        'position.view': 'ALL',
        'attendance.view': 'TEAM',
        'attendance.self': 'ALL',
        'leave.view': 'TEAM',
        'leave.create': 'ALL',
        'leave.approve': 'TEAM',
        'leave.reject': 'TEAM',
        'document.view': 'TEAM',
        'notification.view': 'ALL',
        'report.view': 'TEAM',
        'report.export': 'TEAM',
    },
    employee: {
        'employee.view': 'OWN',
        'employee.view_private': 'OWN',
        'department.view': 'ALL',
        'position.view': 'ALL',
        'attendance.view': 'OWN',
        'attendance.self': 'ALL',
        'leave.view': 'OWN',
        'leave.create': 'ALL',
        'document.view': 'OWN',
        'document.upload': 'OWN',
        'notification.view': 'ALL',
    },
};
//# sourceMappingURL=roles.js.map