/** Short, consistent wording for notifications. Pure, so it is easy to test and reuse. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-09-24` → `24 Sep`. */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

/** `24 Sep`, `24–26 Sep`, or `30 Sep – 2 Oct`. */
export function dateRange(start: string, end: string): string {
  if (start === end) return shortDate(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8, 10))}–${shortDate(end)}`;
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function days(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

/** `3 people were absent and 1 didn't check out`. Empty when both are zero. */
export function attendanceIssues(absent: number, missingCheckOuts: number): string {
  const parts: string[] = [];
  if (absent > 0) parts.push(`${absent} ${absent === 1 ? 'person was' : 'people were'} absent`);
  if (missingCheckOuts > 0) parts.push(`${missingCheckOuts} didn’t check out`);
  return parts.join(' and ');
}
