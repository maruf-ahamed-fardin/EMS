// Shared with the reports, so both use the same words
export { ATTENDANCE_STATUS_LABELS } from '@/lib/validations';

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Dhaka' });

/** An instant as HH:mm in Dhaka, the organization's time zone. */
export function formatTime(iso: string | null): string {
  return iso ? timeFormat.format(new Date(iso)) : '—';
}

/** 535 → "8h 55m"; 0 → "—". */
export function formatDuration(minutes: number | null): string {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h${rest > 0 ? ` ${String(rest).padStart(2, '0')}m` : ''}` : `${rest}m`;
}

/** Today in Dhaka as YYYY-MM-DD, and the first day of its month. */
export function dhakaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(now);
}

export function monthStartOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The attendance list URL with some filters changed; changing a filter returns to page 1. */
export function attendanceHref(current: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const merged = { ...current, ...changes };
  if (!('page' in changes)) delete merged.page;
  const params = new URLSearchParams(Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const query = params.toString();
  return query ? `/attendance?${query}` : '/attendance';
}

/** "HH:mm" in Dhaka for an ISO instant, for prefilling a correction form. */
export function toClockInput(iso: string | null): string {
  return iso ? timeFormat.format(new Date(iso)) : '';
}
