import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './api';
import { isoDate } from './employees';

/**
 * Every action the audit log records (plan §8), with how the viewer describes it. A test compares this
 * list with the actions the backend writes, both ways, so neither can drift from the other.
 */
export const AUDIT_ACTIONS = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.logout': 'Signed out',
  'auth.sessions_revoked': 'Signed out other sessions',
  'auth.password_reset_requested': 'Asked for a password reset link',
  'auth.password_reset': 'Reset their password',
  'auth.password_changed': 'Changed their password',
  'user.created': 'Created a sign-in account',
  'user.role_changed': 'Changed an account’s role',
  'user.activated': 'Activated an account',
  'user.deactivated': 'Deactivated an account',
  'user.reset_link_sent': 'Sent a password link',
  'role.permissions_changed': 'Changed a role’s permissions',
  'employee.created': 'Added an employee',
  'employee.updated': 'Edited an employee',
  'employee.deactivated': 'Deactivated an employee',
  'employee.reactivated': 'Reactivated an employee',
  'employee.deleted': 'Deleted an employee',
  'department.created': 'Created a department',
  'department.updated': 'Edited a department',
  'department.deleted': 'Deleted a department',
  'position.created': 'Created a position',
  'position.updated': 'Edited a position',
  'position.deleted': 'Deleted a position',
  'attendance.corrected': 'Corrected attendance',
  'attendance.day_closed': 'Closed an attendance day',
  'settings.updated': 'Changed settings',
  'holiday.created': 'Added a holiday',
  'holiday.deleted': 'Removed a holiday',
  'leave.requested': 'Requested leave',
  'leave.approved': 'Approved leave',
  'leave.rejected': 'Rejected leave',
  'leave.cancelled': 'Cancelled leave',
  'leave_balance.adjusted': 'Adjusted a leave balance',
  'leave_balance.allocated': 'Created leave balances for a year',
  'leave_type.created': 'Created a leave type',
  'leave_type.updated': 'Edited a leave type',
  'leave_type.deleted': 'Deleted a leave type',
  'document.uploaded': 'Uploaded a document',
  'document.accessed': 'Opened a document',
  'document.deleted': 'Deleted a document',
  'document_type.created': 'Created a document type',
  'document_type.updated': 'Edited a document type',
  'document_type.deleted': 'Deleted a document type',
  'report.exported': 'Exported a report',
  'team_profile.updated': 'Edited their team profile card',
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;
export const AUDIT_ACTION_KEYS = Object.keys(AUDIT_ACTIONS) as AuditAction[];

/** What an audit entry is about, in words for the filter. */
export const AUDIT_ENTITY_TYPES = {
  user: 'Sign-in accounts',
  role: 'Roles',
  employee: 'Employees',
  department: 'Departments',
  position: 'Positions',
  attendance: 'Attendance',
  setting: 'Settings',
  holiday: 'Holidays',
  leave_request: 'Leave requests',
  leave_balance: 'Leave balances',
  leave_type: 'Leave types',
  document: 'Documents',
  document_type: 'Document types',
  report: 'Reports',
  team_profile: 'Team profile cards',
} as const;
export type AuditEntityType = keyof typeof AUDIT_ENTITY_TYPES;

export const auditListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(25),
  action: z.enum(AUDIT_ACTION_KEYS as [AuditAction, ...AuditAction[]]).optional().catch(undefined),
  entityType: z.enum(Object.keys(AUDIT_ENTITY_TYPES) as [AuditEntityType, ...AuditEntityType[]]).optional().catch(undefined),
  entityId: z.string().max(64).optional().transform((v) => v || undefined),
  actorUserId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
  /** Days in the organization's time zone. */
  from: z.union([isoDate, z.literal('')]).optional().transform((v) => v || undefined),
  to: z.union([isoDate, z.literal('')]).optional().transform((v) => v || undefined),
});
export type AuditListQuery = z.infer<typeof auditListQuery>;

export interface AuditActor {
  id: string;
  name: string;
  email: string;
}

export interface AuditListItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  /** The person, department or other record the entry is about, when it still exists. */
  entityLabel: string | null;
  /** Null for the system (jobs) or someone not signed in (a failed sign-in, a reset request). */
  actor: AuditActor | null;
  /** Names of the fields in before/after; values are only in the detail. */
  changedFields: string[];
  createdAt: string;
}

/** One field as it was and as it became. `hidden` when the viewer may not see its values. */
export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
  hidden?: boolean;
}

export interface AuditDetail extends AuditListItem {
  changes: AuditChange[];
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}
