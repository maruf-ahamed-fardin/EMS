import type { PermissionScope } from './enums';
/**
 * The permission catalogue. The backend seeds the `permissions` table from this list, the guard
 * checks these keys and the UI hides controls with them. New modules add keys here; nothing else
 * about roles is hardcoded.
 */
export declare const PERMISSIONS: {
    readonly 'employee.view': {
        readonly module: "employees";
        readonly description: "View employee profiles";
    };
    readonly 'employee.view_private': {
        readonly module: "employees";
        readonly description: "View date of birth, address, emergency contact and ID documents";
    };
    readonly 'employee.create': {
        readonly module: "employees";
        readonly description: "Add employees";
    };
    readonly 'employee.update': {
        readonly module: "employees";
        readonly description: "Edit employee records";
    };
    readonly 'employee.delete': {
        readonly module: "employees";
        readonly description: "Delete employees";
    };
    readonly 'department.view': {
        readonly module: "departments";
        readonly description: "View departments";
    };
    readonly 'department.create': {
        readonly module: "departments";
        readonly description: "Create departments";
    };
    readonly 'department.update': {
        readonly module: "departments";
        readonly description: "Edit departments";
    };
    readonly 'department.delete': {
        readonly module: "departments";
        readonly description: "Delete departments";
    };
    readonly 'position.view': {
        readonly module: "positions";
        readonly description: "View positions";
    };
    readonly 'position.manage': {
        readonly module: "positions";
        readonly description: "Create, edit and delete positions";
    };
    readonly 'attendance.view': {
        readonly module: "attendance";
        readonly description: "View attendance records";
    };
    readonly 'attendance.manage': {
        readonly module: "attendance";
        readonly description: "Correct attendance records";
    };
    readonly 'attendance.self': {
        readonly module: "attendance";
        readonly description: "Check in and out for yourself";
    };
    readonly 'leave.view': {
        readonly module: "leave";
        readonly description: "View leave requests and balances";
    };
    readonly 'leave.create': {
        readonly module: "leave";
        readonly description: "Request leave";
    };
    readonly 'leave.approve': {
        readonly module: "leave";
        readonly description: "Approve leave requests";
    };
    readonly 'leave.reject': {
        readonly module: "leave";
        readonly description: "Reject leave requests";
    };
    readonly 'leave.manage_types': {
        readonly module: "leave";
        readonly description: "Manage leave types";
    };
    readonly 'leave.manage_balances': {
        readonly module: "leave";
        readonly description: "Adjust leave balances";
    };
    readonly 'document.view': {
        readonly module: "documents";
        readonly description: "View employee documents";
    };
    readonly 'document.upload': {
        readonly module: "documents";
        readonly description: "Upload documents";
    };
    readonly 'document.delete': {
        readonly module: "documents";
        readonly description: "Delete documents";
    };
    readonly 'notification.view': {
        readonly module: "notifications";
        readonly description: "Receive notifications";
    };
    readonly 'report.view': {
        readonly module: "reports";
        readonly description: "View reports";
    };
    readonly 'report.export': {
        readonly module: "reports";
        readonly description: "Export reports";
    };
    readonly 'user.view': {
        readonly module: "administration";
        readonly description: "View user accounts";
    };
    readonly 'user.manage': {
        readonly module: "administration";
        readonly description: "Create and change user accounts";
    };
    readonly 'role.manage': {
        readonly module: "administration";
        readonly description: "Change role permissions";
    };
    readonly 'audit.view': {
        readonly module: "administration";
        readonly description: "View the audit log";
    };
    readonly 'settings.manage': {
        readonly module: "administration";
        readonly description: "Change organization settings";
    };
};
export type PermissionKey = keyof typeof PERMISSIONS;
export declare const PERMISSION_KEYS: PermissionKey[];
export declare function isPermissionKey(value: string): value is PermissionKey;
/** What `GET /auth/me` returns: each granted permission and how far it reaches. */
export type PermissionMap = Partial<Record<PermissionKey, PermissionScope>>;
/** True when `map` grants `key` at `atLeast` or wider. */
export declare function can(map: PermissionMap, key: PermissionKey, atLeast?: PermissionScope): boolean;
//# sourceMappingURL=permissions.d.ts.map