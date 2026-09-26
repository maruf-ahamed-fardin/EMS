import { z } from 'zod';
import type { AttendanceStatus, LeaveRequestStatus } from './enums';
import type { EmployeeListItem } from '@/lib/validations/employee';

// ─── Working calendar (plan D6) ─────────────────────────────────────────────────────────────────

/** 0 = Sunday … 6 = Saturday, as `Date.getDay()` counts. */
export const Weekday = z.number().int().min(0).max(6);

export const attendanceSettings = z.object({
  timeZone: z.string().min(1).default('Asia/Dhaka'),
  /** Days nobody is expected at work. Bangladesh: Friday. */
  weekendDays: z.array(Weekday).max(6).default([5]),
  /** HH:mm in the organization's time zone. */
  workdayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').default('09:00'),
  graceMinutes: z.number().int().min(0).max(240).default(15),
});
export type AttendanceSettings = z.infer<typeof attendanceSettings>;

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = attendanceSettings.parse({});

// ─── Dashboard ──────────────────────────────────────────────────────────────────────────────────

/** Organization (HR, Super Admin), team (managers) or personal (everyone else). */
export type DashboardVariant = 'organization' | 'team' | 'personal';

export interface AttendanceToday {
  /** Active employees expected at work today (not on approved leave, and today is a working day). */
  expected: number;
  present: number;
  onTime: number;
  late: number;
  onLeave: number;
  /** Expected but without a check-in yet. Absences are only settled after the day ends (assumption 3). */
  notCheckedIn: number;
  /** present / expected, 0–1. Null when nobody is expected. */
  presentRate: number | null;
}

export interface PendingLeaveItem {
  id: string;
  employee: { id: string; name: string };
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  requestedAt: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  actor: string | null;
  entityType: string;
  entityId: string | null;
  /** The employee the entry is about, when it is about one. */
  subject: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeaveBalanceItem {
  leaveType: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

export interface MyDay {
  employeeId: string;
  attendanceToday: { status: AttendanceStatus; firstInAt: string | null; lastOutAt: string | null } | null;
  onLeaveToday: boolean;
  leaveBalances: LeaveBalanceItem[];
  pendingRequests: Array<{ id: string; leaveType: string; startDate: string; endDate: string; days: number; status: LeaveRequestStatus }>;
}

export interface DashboardOverview {
  variant: DashboardVariant;
  generatedAt: string;
  /** YYYY-MM-DD in the organization's time zone. */
  today: string;
  isWorkingDay: boolean;
  /** Late after this time today, e.g. "09:15". */
  lateAfter: string;
  /** Team and organization variants. */
  headcount: {
    total: number;
    joinedThisMonth: number;
    byDepartment: Array<{ departmentId: string; name: string; count: number }>;
  } | null;
  attendanceToday: AttendanceToday | null;
  attention: {
    pendingLeaveRequests: number;
    oldestPendingDays: number | null;
    notCheckedIn: number;
    documentsExpiringSoon: number;
    /** Active employees who can't sign in yet. Null for people without `user.view`. */
    withoutAccount: number | null;
  } | null;
  pendingLeave: PendingLeaveItem[];
  outToday: { total: number; people: Array<{ id: string; name: string }> } | null;
  newJoiners: EmployeeListItem[];
  activity: ActivityItem[];
  /** The signed-in person's own day, when they have an employee record. */
  me: MyDay | null;
}

export const TREND_RANGES = ['today', 'week', 'month'] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

export const attendanceTrendQuery = z.object({
  range: z.enum(TREND_RANGES).default('week').catch('week'),
});

export interface AttendanceTrendPoint {
  /** YYYY-MM-DD for week and month; HH:00 for today. */
  key: string;
  label: string;
  expected: number;
  present: number;
  onTime: number;
}

export interface AttendanceTrend {
  range: TrendRange;
  points: AttendanceTrendPoint[];
}

// ─── Global search ──────────────────────────────────────────────────────────────────────────────

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(100),
});

export interface SearchResults {
  employees: Array<{ id: string; name: string; employeeCode: string; positionTitle: string; departmentName: string }>;
  departments: Array<{ id: string; name: string; code: string }>;
  positions: Array<{ id: string; title: string; departmentId: string | null; departmentName: string | null }>;
}

export const SEARCH_RESULT_LIMIT = 5;
