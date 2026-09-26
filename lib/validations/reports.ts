import { z } from 'zod';
import type { PageMeta } from './api';
import { isoDate } from '@/lib/validations/employee';
import { AttendanceStatus, EmployeeStatus, EmploymentType, LeaveRequestStatus } from './enums';

export const REPORT_KEYS = ['employees', 'attendance', 'leave', 'departments'] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_FORMATS = ['json', 'csv', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

/** Plan §10: bigger exports get 413 and a request to narrow the filters. */
export const MAX_EXPORT_ROWS = 50_000;

/** One cell: text, a number, or empty. Dates are `YYYY-MM-DD`, times `HH:mm` in the organization's time zone. */
export type ReportCell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  /** Numbers are right-aligned and stay numbers in XLSX. */
  numeric?: boolean;
}

export interface ReportSummary {
  /** Headline figures, e.g. "Present rate: 94%". */
  figures: Array<{ label: string; value: string | number }>;
  /** Small breakdowns, e.g. headcount by status. */
  sections: Array<{ title: string; rows: Array<{ label: string; value: string | number }> }>;
}

/** The JSON form of every report; the exports carry the same columns, rows, summary and filters. */
export interface ReportResponse {
  title: string;
  /** The applied filters in words, e.g. "Department: Engineering". */
  filters: string[];
  columns: ReportColumn[];
  data: Array<Record<string, ReportCell>>;
  meta: PageMeta;
  summary: ReportSummary;
}

// ─── Filters ────────────────────────────────────────────────────────────────────────────────────

const optionalId = z
  .union([z.uuid(), z.literal('')])
  .optional()
  .transform((value) => value || undefined);
const optionalDate = z
  .union([isoDate, z.literal('')])
  .optional()
  .transform((value) => value || undefined);
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional().catch(undefined);

const base = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  format: z.enum(REPORT_FORMATS).default('json'),
};

/** A required date range of at most a year, so an export can't cover the whole history by accident. */
const range = { from: isoDate, to: isoDate };
function checkRange(q: { from: string; to: string }, ctx: z.RefinementCtx): void {
  if (q.to < q.from) ctx.addIssue({ code: 'custom', path: ['to'], message: 'The end date must be on or after the start date' });
  else if (new Date(`${q.to}T00:00:00Z`).getTime() - new Date(`${q.from}T00:00:00Z`).getTime() > 366 * 86_400_000) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Choose a range of a year or less' });
  }
}

export const employeesReportQuery = z
  .object({
    ...base,
    departmentId: optionalId,
    status: optionalEnum(EmployeeStatus),
    employmentType: optionalEnum(EmploymentType),
    joinedFrom: optionalDate,
    joinedTo: optionalDate,
  })
  .refine((q) => !q.joinedFrom || !q.joinedTo || q.joinedTo >= q.joinedFrom, { path: ['joinedTo'], message: 'The end date must be on or after the start date' });
export type EmployeesReportQuery = z.infer<typeof employeesReportQuery>;

export const attendanceReportQuery = z
  .object({ ...base, ...range, departmentId: optionalId, employeeId: optionalId, status: optionalEnum(AttendanceStatus) })
  .superRefine(checkRange);
export type AttendanceReportQuery = z.infer<typeof attendanceReportQuery>;

/** Leave that overlaps the range. */
export const leaveReportQuery = z
  .object({ ...base, ...range, departmentId: optionalId, employeeId: optionalId, status: optionalEnum(LeaveRequestStatus), leaveTypeId: optionalId })
  .superRefine(checkRange);
export type LeaveReportQuery = z.infer<typeof leaveReportQuery>;

/** Joined and left are counted within the range. */
export const departmentsReportQuery = z.object({ ...base, ...range }).superRefine(checkRange);
export type DepartmentsReportQuery = z.infer<typeof departmentsReportQuery>;

export const REPORT_QUERIES = {
  employees: employeesReportQuery,
  attendance: attendanceReportQuery,
  leave: leaveReportQuery,
  departments: departmentsReportQuery,
} as const;

export const REPORT_TITLES: Record<ReportKey, string> = {
  employees: 'Employees',
  attendance: 'Attendance',
  leave: 'Leave',
  departments: 'Departments',
};
