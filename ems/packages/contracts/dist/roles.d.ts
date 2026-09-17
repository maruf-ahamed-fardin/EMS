import type { PermissionScope } from './enums';
import { type PermissionKey } from './permissions';
export declare const SYSTEM_ROLES: {
    readonly super_admin: {
        readonly name: "Super Admin";
        readonly description: "Full access, including roles and security settings";
    };
    readonly hr_admin: {
        readonly name: "HR / Admin";
        readonly description: "Runs day-to-day HR for the whole organization";
    };
    readonly manager: {
        readonly name: "Manager";
        readonly description: "Sees and approves for their direct reports";
    };
    readonly employee: {
        readonly name: "Employee";
        readonly description: "Sees their own records";
    };
};
export type SystemRoleKey = keyof typeof SYSTEM_ROLES;
type Grants = Partial<Record<PermissionKey, PermissionScope>>;
/**
 * The default permission matrix (plan §4). It is seeded once and then edited in
 * Roles & Permissions, so at runtime the database is the source of truth, not this object.
 * Permissions that have no meaningful reach (such as `attendance.self`) are granted as ALL.
 */
export declare const DEFAULT_ROLE_GRANTS: Record<SystemRoleKey, Grants>;
export {};
//# sourceMappingURL=roles.d.ts.map