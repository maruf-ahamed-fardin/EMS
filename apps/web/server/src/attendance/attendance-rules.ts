import type { AttendanceSettings, AttendanceStatus } from '@ems/contracts';
import { lateAfter, zonedDate, zonedTime } from '../calendar/work-calendar';

/**
 * The attendance rules from plan §7, as pure functions. The web check-in, device punches, admin
 * corrections, the day-closing job and the demo seed all use these, so "late" means one thing.
 */

/** PRESENT or LATE for a check-in, and how many minutes after the start of the day it was. */
export function checkInStatus(
  firstInAt: Date,
  workDate: string,
  settings: Pick<AttendanceSettings, 'timeZone' | 'workdayStart' | 'graceMinutes'>,
  workingDay: boolean,
): { status: 'PRESENT' | 'LATE'; lateMinutes: number } {
  // Coming in on a weekend or holiday is never late
  if (!workingDay) return { status: 'PRESENT', lateMinutes: 0 };
  const threshold = zonedTime(workDate, lateAfter(settings), settings.timeZone);
  if (firstInAt.getTime() <= threshold.getTime()) return { status: 'PRESENT', lateMinutes: 0 };
  const start = zonedTime(workDate, settings.workdayStart, settings.timeZone);
  return { status: 'LATE', lateMinutes: Math.round((firstInAt.getTime() - start.getTime()) / 60_000) };
}

export function workedMinutes(firstInAt: Date | null, lastOutAt: Date | null): number {
  if (!firstInAt || !lastOutAt) return 0;
  return Math.max(0, Math.round((lastOutAt.getTime() - firstInAt.getTime()) / 60_000));
}

/** The status a day gets when it closes without a check-in (assumption 3). */
export function closingStatus(day: { holiday: boolean; weekend: boolean; onLeave: boolean }): AttendanceStatus {
  if (day.holiday) return 'HOLIDAY';
  if (day.weekend) return 'WEEKEND';
  if (day.onLeave) return 'ON_LEAVE';
  return 'ABSENT';
}

/** Statuses that mean nobody worked, so a correction can't carry times with them. */
export const NO_TIME_STATUSES: readonly AttendanceStatus[] = ['ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'];

/** Days close at 23:55 in the organization's time zone (plan §7), or any time after they've passed. */
export const CLOSE_AT_HOUR = 23;
export const CLOSE_AT_MINUTE = 55;

export function isClosable(date: string, now: Date, timeZone: string): boolean {
  const today = zonedDate(now, timeZone);
  if (date < today) return true;
  if (date > today) return false;
  const closeAt = zonedTime(date, `${CLOSE_AT_HOUR}:${CLOSE_AT_MINUTE}`, timeZone);
  return now.getTime() >= closeAt.getTime();
}

