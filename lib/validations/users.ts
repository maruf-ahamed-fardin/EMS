import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './api';
import { UserStatus } from './enums';

export interface UserListItem {
  id: string;
  email: string;
  /** The employee's name, or the part of the email before the @ for an account without one. */
  name: string;
  employee: { id: string; name: string; employeeCode: string; status: 'ACTIVE' | 'INACTIVE' } | null;
  role: { id: string; key: string; name: string };
  status: UserStatus;
  /** Too many wrong passwords: signing in is blocked until this time, or until someone activates it. */
  lockedUntil: string | null;
  lastLoginAt: string | null;
  /** What the viewer may do. Nobody changes their own role or deactivates themselves. */
  allowedActions: { changeRole: boolean; deactivate: boolean; activate: boolean; sendReset: boolean };
}

export const userListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(25),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  roleId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(UserStatus).optional().catch(undefined),
});
export type UserListQuery = z.infer<typeof userListQuery>;

/** An account for an employee who doesn't have one yet; they choose a password through an emailed link. */
export const createUserInput = z.object({
  employeeId: z.uuid('Choose an employee'),
  roleId: z.uuid('Choose a role'),
});
export type CreateUserInput = z.input<typeof createUserInput>;

export const changeUserRoleInput = z.object({ roleId: z.uuid('Choose a role') });
export type ChangeUserRoleInput = z.input<typeof changeUserRoleInput>;

export interface UserFormOptions {
  roles: Array<{ id: string; key: string; name: string; description: string | null }>;
  /** Active employees without an account, for "Create account". */
  employeesWithoutAccount: Array<{ id: string; name: string; employeeCode: string; email: string }>;
}
