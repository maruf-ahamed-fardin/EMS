import type { AttendanceSettings } from '@ems/contracts';
import { addDays, dateOnly, weekday } from '../calendar/work-calendar';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The working days a leave request covers (plan §7, assumption 4): whole days, weekends and holidays
 * excluded. Pure, so the preview, the request and the tests all count the same way.
 */
export function countLeaveDays(
  startDate: string,
  endDate: string,
  settings: Pick<AttendanceSettings, 'weekendDays'>,
  holidays: ReadonlyMap<string, string>,
): { workingDays: string[]; excludedDays: Array<{ date: string; reason: string }> } {
  const workingDays: string[] = [];
  const excludedDays: Array<{ date: string; reason: string }> = [];
  for (let date = startDate, guard = 0; date <= endDate && guard < 400; date = addDays(date, 1), guard++) {
    const holiday = holidays.get(date);
    if (holiday) excludedDays.push({ date, reason: holiday });
    else if (settings.weekendDays.includes(weekday(date))) excludedDays.push({ date, reason: WEEKDAY_NAMES[weekday(date)]! });
    else workingDays.push(date);
  }
  return { workingDays, excludedDays };
}

/** Rounds down to the nearest half day, so a prorated allowance never gives more than earned. */
export function roundDownToHalf(value: number): number {
  return Math.floor(value * 2) / 2;
}

/**
 * The allowance for `year` for someone who joined on `joiningDate`: the full yearly allowance if they
 * joined before the year, the share of the year still ahead of them if they joined during it, and
 * nothing if they join after it.
 */
export function proratedAllocation(defaultDaysPerYear: number, joiningDate: string, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (joiningDate <= yearStart) return defaultDaysPerYear;
  if (joiningDate > yearEnd) return 0;
  const daysInYear = (dateOnly(`${year + 1}-01-01`).getTime() - dateOnly(yearStart).getTime()) / 86_400_000;
  const remaining = (dateOnly(`${year + 1}-01-01`).getTime() - dateOnly(joiningDate).getTime()) / 86_400_000;
  return roundDownToHalf((defaultDaysPerYear * remaining) / daysInYear);
}

/** Unused days that move into the next year, capped per leave type. Never negative. */
export function carryForward(previous: { allocated: number; carriedForward: number; used: number; pending: number } | null, cap: number): number {
  if (!previous || cap <= 0) return 0;
  const unused = previous.allocated + previous.carriedForward - previous.used - previous.pending;
  return Math.max(0, Math.min(unused, cap));
}

export function available(balance: { allocated: number; carriedForward: number; used: number; pending: number }): number {
  return balance.allocated + balance.carriedForward - balance.used - balance.pending;
}
