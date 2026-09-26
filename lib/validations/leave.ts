import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './api';
import { LeaveRequestStatus } from './enums';
import { isoDate } from '@/lib/validations/employee';

const days = (label: string) =>
  z.coerce
    .number<string | number>(`Enter ${label}`)
    .min(0, `${label[0]!.toUpperCase()}${label.slice(1)} can't be negative`)
    .max(365, 'Keep it under 365 days')
    .refine((value) => Number.isInteger(value * 2), 'Use whole or half days');

// ─── Leave types ────────────────────────────────────────────────────────────────────────────────

const leaveTypeFields = {
  name: z.string().trim().min(1, 'Name the leave type').max(100, 'Keep the name under 100 characters'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,19}$/, 'Use 2–20 letters, digits or underscores, e.g. ANNUAL'),
  defaultDaysPerYear: days('the yearly allowance'),
  carryForwardMax: days('the carry-forward limit').default(0),
  isPaid: z.boolean().default(true),
  requiresDocument: z.boolean().default(false),
  isActive: z.boolean().default(true),
};

export const createLeaveTypeInput = z.object(leaveTypeFields);
export type CreateLeaveTypeInput = z.input<typeof createLeaveTypeInput>;

export const updateLeaveTypeInput = z
  .object({
    name: leaveTypeFields.name,
    code: leaveTypeFields.code,
    defaultDaysPerYear: days('the yearly allowance'),
    carryForwardMax: days('the carry-forward limit'),
    isPaid: z.boolean(),
    requiresDocument: z.boolean(),
    isActive: z.boolean(),
  })
  .partial()
  .strict();
export type UpdateLeaveTypeInput = z.input<typeof updateLeaveTypeInput>;

export interface LeaveTypeItem {
  id: string;
  name: string;
  code: string;
  defaultDaysPerYear: number;
  carryForwardMax: number;
  isPaid: boolean;
  requiresDocument: boolean;
  isActive: boolean;
  pendingRequests: number;
}

// ─── Balances ───────────────────────────────────────────────────────────────────────────────────

export interface LeaveBalanceRow {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  leaveType: { id: string; name: string; code: string; isPaid: boolean };
  year: number;
  allocated: number;
  carriedForward: number;
  used: number;
  pending: number;
  available: number;
}

export const leaveBalanceQuery = z.object({
  employeeId: z.uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const adjustLeaveBalanceInput = z
  .object({
    allocated: days('the allowance').optional(),
    carriedForward: days('the carried-forward days').optional(),
    note: z.string().trim().min(3, 'Say why the balance is changing').max(500, 'Keep the note under 500 characters'),
  })
  .refine((value) => value.allocated !== undefined || value.carriedForward !== undefined, {
    path: ['allocated'],
    message: 'Change the allowance or the carried-forward days',
  });
export type AdjustLeaveBalanceInput = z.input<typeof adjustLeaveBalanceInput>;

export const allocateYearInput = z.object({ year: z.number().int().min(2000).max(2100) });

// ─── Requests ───────────────────────────────────────────────────────────────────────────────────

const range = z
  .object({ leaveTypeId: z.uuid('Choose a leave type'), startDate: isoDate, endDate: isoDate })
  .refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'The last day must be on or after the first day' })
  .refine((value) => value.startDate.slice(0, 4) === value.endDate.slice(0, 4), {
    path: ['endDate'],
    message: 'Leave can’t cross into another year. Request each year separately.',
  });

export const leavePreviewInput = range;
export type LeavePreviewInput = z.input<typeof leavePreviewInput>;

export const createLeaveRequestInput = z
  .object({
    leaveTypeId: z.uuid('Choose a leave type'),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim().min(3, 'Add a short reason').max(1000, 'Keep the reason under 1000 characters'),
  })
  .refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'The last day must be on or after the first day' })
  .refine((value) => value.startDate.slice(0, 4) === value.endDate.slice(0, 4), {
    path: ['endDate'],
    message: 'Leave can’t cross into another year. Request each year separately.',
  });
export type CreateLeaveRequestInput = z.input<typeof createLeaveRequestInput>;

export const reviewLeaveInput = z.object({
  note: z.string().trim().max(1000, 'Keep the note under 1000 characters').optional(),
});

export const rejectLeaveInput = z.object({
  note: z.string().trim().min(3, 'Tell them why it was rejected').max(1000, 'Keep the note under 1000 characters'),
});

export const leaveRequestListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
  status: z.enum(LeaveRequestStatus).optional().catch(undefined),
  employeeId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  /** Only requests the viewer could approve or reject (the review queue). */
  reviewable: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  /** Only the viewer's own requests. */
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
});
export type LeaveRequestListQuery = z.infer<typeof leaveRequestListQuery>;

export interface LeavePreview {
  days: number;
  /** The working days the request covers, YYYY-MM-DD. */
  workingDays: string[];
  /** Weekends and holidays inside the range that don't count. */
  excludedDays: Array<{ date: string; reason: string }>;
  isPaid: boolean;
  /** Null for unpaid leave, which has no balance. */
  available: number | null;
  availableAfter: number | null;
  overlaps: Array<{ id: string; startDate: string; endDate: string; status: LeaveRequestStatus; leaveType: string }>;
  /** Everything that would stop the request, in plain words. Empty means it can be submitted. */
  problems: string[];
}

export interface LeaveRequestItem {
  id: string;
  employee: { id: string; name: string; employeeCode: string; departmentName: string };
  leaveType: { id: string; name: string; isPaid: boolean };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** What the viewer may do with it now. */
  allowedActions: { approve: boolean; reject: boolean; cancel: boolean };
  /** The employee's available days of this type before approval (pending already deducted); null for unpaid. */
  balanceAvailable: number | null;
}
