import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './api';
import { attendanceSettings } from './dashboard';
import { AttendanceSource, AttendanceStatus } from './enums';
import { isoDate } from '@/lib/validations/employee';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, e.g. 09:05');

// ─── Reading ────────────────────────────────────────────────────────────────────────────────────

export const attendanceListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  employeeId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  departmentId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(AttendanceStatus).optional().catch(undefined),
});
export type AttendanceListQuery = z.infer<typeof attendanceListQuery>;

export const attendanceSummaryQuery = z.object({
  from: isoDate,
  to: isoDate,
  employeeId: z.uuid().optional(),
});

export interface AttendanceItem {
  id: string;
  employee: { id: string; name: string; employeeCode: string; departmentName: string };
  workDate: string;
  firstInAt: string | null;
  lastOutAt: string | null;
  workedMinutes: number;
  lateMinutes: number;
  status: AttendanceStatus;
  note: string | null;
  /** Changed by an administrator after the fact. */
  corrected: boolean;
}

export interface AttendanceSummary {
  from: string;
  to: string;
  byStatus: Record<AttendanceStatus, number>;
  /** (present + late) / (present + late + absent); null when nobody was expected. */
  presentRate: number | null;
  averageWorkedMinutes: number | null;
  totalLateMinutes: number;
}

/** The signed-in person's attendance for today, and what they can do next. */
export interface MyAttendanceToday {
  today: string;
  isWorkingDay: boolean;
  lateAfter: string;
  onLeave: boolean;
  attendance: Pick<AttendanceItem, 'id' | 'firstInAt' | 'lastOutAt' | 'workedMinutes' | 'lateMinutes' | 'status'> | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  /** Why checking in or out isn't possible, in plain words. */
  reason: string | null;
}

// ─── Corrections ────────────────────────────────────────────────────────────────────────────────

/**
 * Times are wall-clock `HH:mm` in the organization's time zone, never ISO instants, so the browser's
 * own time zone can't shift a correction.
 */
const correctionFields = {
  firstIn: hhmm.nullable(),
  lastOut: hhmm.nullable(),
  /** Leave empty to derive PRESENT/LATE from the times. Set it for ABSENT, ON_LEAVE and the like. */
  status: z.enum(AttendanceStatus).optional(),
  note: z.string().trim().min(3, 'Say why this is being corrected').max(500, 'Keep the note under 500 characters'),
};

function timesInOrder(value: { firstIn?: string | null; lastOut?: string | null }) {
  return !value.firstIn || !value.lastOut || value.lastOut > value.firstIn;
}

export const correctAttendanceInput = z
  .object(correctionFields)
  .refine((value) => !(value.lastOut && !value.firstIn), { path: ['firstIn'], message: 'A check-out needs a check-in time' })
  .refine(timesInOrder, { path: ['lastOut'], message: 'Check-out must be after check-in' });
export type CorrectAttendanceInput = z.input<typeof correctAttendanceInput>;

export const createAttendanceInput = z
  .object({ ...correctionFields, employeeId: z.uuid('Choose an employee'), workDate: isoDate })
  .refine((value) => !(value.lastOut && !value.firstIn), { path: ['firstIn'], message: 'A check-out needs a check-in time' })
  .refine(timesInOrder, { path: ['lastOut'], message: 'Check-out must be after check-in' });
export type CreateAttendanceInput = z.input<typeof createAttendanceInput>;

export const closeDayInput = z.object({ date: isoDate });

// ─── Settings and holidays ──────────────────────────────────────────────────────────────────────

export const updateAttendanceSettingsInput = attendanceSettings
  .extend({
    timeZone: z.string().min(1).refine((zone) => {
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, 'Choose a valid time zone, e.g. Asia/Dhaka'),
    weekendDays: z
      .array(z.number().int().min(0).max(6))
      .max(6, 'At least one day a week must be a working day')
      .refine((days) => new Set(days).size === days.length, 'Each day can only be listed once'),
    workdayStart: hhmm,
    graceMinutes: z.number().int().min(0, 'Use 0 or more minutes').max(240, 'Keep the grace period under 4 hours'),
  })
  .partial()
  .strict();
export type UpdateAttendanceSettingsInput = z.input<typeof updateAttendanceSettingsInput>;

export const createHolidayInput = z.object({
  date: isoDate,
  name: z.string().trim().min(1, 'Name the holiday').max(100, 'Keep the name under 100 characters'),
});
export type CreateHolidayInput = z.input<typeof createHolidayInput>;

export const holidayListQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
}

// ─── Punches (plan §1 extension point) ──────────────────────────────────────────────────────────

/** What every attendance source (web, mobile, device) sends to record a punch. */
export interface PunchInput {
  employeeId: string;
  occurredAt: Date;
  type: 'CHECK_IN' | 'CHECK_OUT';
  source: AttendanceSource;
  deviceId?: string | null;
  ip?: string | null;
}
