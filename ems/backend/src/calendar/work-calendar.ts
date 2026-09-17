import type { AttendanceSettings } from '@ems/contracts';

/**
 * Dates in the organization's time zone (plan D6). Every "today", "late" and "working day" decision
 * goes through these functions, so midnight and time zone edge cases are handled in one place.
 * Calendar days are `YYYY-MM-DD` strings; instants are `Date`.
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** The calendar day an instant falls on in `timeZone`. */
export function zonedDate(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The hour (0–23) of an instant in `timeZone`. */
export function zonedHour(instant: Date, timeZone: string): number {
  return zonedParts(instant, timeZone).hour;
}

/** The instant a wall-clock time on a calendar day happens in `timeZone`. */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // The zone's offset at that moment: how far its wall clock is from UTC
  const seen = zonedParts(new Date(guess), timeZone);
  const offset = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - guess;
  return new Date(guess - offset);
}

/** A calendar day as a UTC-midnight Date, which is how `@db.Date` columns store it. */
export function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addDays(date: string, days: number): string {
  const next = dateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return dateOnly(date).getUTCDay();
}

export function isWorkingDay(date: string, settings: Pick<AttendanceSettings, 'weekendDays'>, holidays: ReadonlySet<string>): boolean {
  return !settings.weekendDays.includes(weekday(date)) && !holidays.has(date);
}

/** The last `count` working days up to and including `until`, oldest first. */
export function workingDaysUpTo(
  until: string,
  count: number,
  settings: Pick<AttendanceSettings, 'weekendDays'>,
  holidays: ReadonlySet<string>,
): string[] {
  const days: string[] = [];
  // Weekends and holidays are skipped; the guard stops a misconfigured "every day is a weekend"
  for (let date = until, guard = 0; days.length < count && guard < count * 7 + 14; date = addDays(date, -1), guard++) {
    if (isWorkingDay(date, settings, holidays)) days.unshift(date);
  }
  return days;
}

/** "09:15": the last on-time check-in, from the start of the working day plus the grace period. */
export function lateAfter(settings: Pick<AttendanceSettings, 'workdayStart' | 'graceMinutes'>): string {
  const [hour, minute] = settings.workdayStart.split(':').map(Number) as [number, number];
  const total = hour * 60 + minute + settings.graceMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** First day of the month containing `date`. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Whole days between two calendar days (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86_400_000);
}
