"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_KEYS = exports.PERMISSIONS = void 0;
exports.isPermissionKey = isPermissionKey;
exports.can = can;
/**
 * The permission catalogue. The backend seeds the `permissions` table from this list, the guard
 * checks these keys and the UI hides controls with them. New modules add keys here; nothing else
 * about roles is hardcoded.
 */
exports.PERMISSIONS = {
    'employee.view': { module: 'employees', description: 'View employee profiles' },
    'employee.view_private': {
        module: 'employees',
        description: 'View date of birth, address, emergency contact and ID documents',
    },
    'employee.create': { module: 'employees', description: 'Add employees' },
    'employee.update': { module: 'employees', description: 'Edit employee records' },
    'employee.delete': { module: 'employees', description: 'Delete employees' },
    'department.view': { module: 'departments', description: 'View departments' },
    'department.create': { module: 'departments', description: 'Create departments' },
    'department.update': { module: 'departments', description: 'Edit departments' },
    'department.delete': { module: 'departments', description: 'Delete departments' },
    'position.view': { module: 'positions', description: 'View positions' },
    'position.manage': { module: 'positions', description: 'Create, edit and delete positions' },
    'attendance.view': { module: 'attendance', description: 'View attendance records' },
    'attendance.manage': { module: 'attendance', description: 'Correct attendance records' },
    'attendance.self': { module: 'attendance', description: 'Check in and out for yourself' },
    'leave.view': { module: 'leave', description: 'View leave requests and balances' },
    'leave.create': { module: 'leave', description: 'Request leave' },
    'leave.approve': { module: 'leave', description: 'Approve leave requests' },
    'leave.reject': { module: 'leave', description: 'Reject leave requests' },
    'leave.manage_types': { module: 'leave', description: 'Manage leave types' },
    'leave.manage_balances': { module: 'leave', description: 'Adjust leave balances' },
    'document.view': { module: 'documents', description: 'View employee documents' },
    'document.upload': { module: 'documents', description: 'Upload documents' },
    'document.delete': { module: 'documents', description: 'Delete documents' },
    'notification.view': { module: 'notifications', description: 'Receive notifications' },
    'report.view': { module: 'reports', description: 'View reports' },
    'report.export': { module: 'reports', description: 'Export reports' },
    'user.view': { module: 'administration', description: 'View user accounts' },
    'user.manage': { module: 'administration', description: 'Create and change user accounts' },
    'role.manage': { module: 'administration', description: 'Change role permissions' },
    'audit.view': { module: 'administration', description: 'View the audit log' },
    'settings.manage': { module: 'administration', description: 'Change organization settings' },
};
exports.PERMISSION_KEYS = Object.keys(exports.PERMISSIONS);
function isPermissionKey(value) {
    return Object.hasOwn(exports.PERMISSIONS, value);
}
const SCOPE_RANK = { OWN: 1, TEAM: 2, ALL: 3 };
/** True when `map` grants `key` at `atLeast` or wider. */
function can(map, key, atLeast = 'OWN') {
    const granted = map[key];
    return granted !== undefined && SCOPE_RANK[granted] >= SCOPE_RANK[atLeast];
}
//# sourceMappingURL=permissions.js.map