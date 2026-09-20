import { REPORT_KEYS, type ReportFormat, type ReportKey } from '@ems/contracts';

/** The filters each report's form shows, in order. Every report also has `from`/`to` except Employees. */
export const REPORT_FILTERS: Record<ReportKey, readonly string[]> = {
  employees: ['departmentId', 'status', 'employmentType', 'joinedFrom', 'joinedTo'],
  attendance: ['from', 'to', 'departmentId', 'status'],
  leave: ['from', 'to', 'departmentId', 'leaveTypeId', 'status'],
  departments: ['from', 'to'],
};

export const REPORT_DESCRIPTIONS: Record<ReportKey, string> = {
  employees: 'Everyone in your scope, with department, manager and status.',
  attendance: 'Daily records with check-in and out times, hours and lateness.',
  leave: 'Requests that overlap the dates, with days taken and left.',
  departments: 'Headcount per department, and who joined or left in the period.',
};

export const FORMAT_LABELS: Record<Exclude<ReportFormat, 'json'>, string> = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' };

export function reportKey(value: string | undefined): ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value ?? '') ? (value as ReportKey) : 'employees';
}

/**
 * A report's default dates when none are chosen: attendance this month so far, leave and departments
 * this year (leave to the year's end, since leave is planned ahead).
 */
export function defaultRange(key: ReportKey, today: string): { from?: string; to?: string } {
  const year = today.slice(0, 4);
  if (key === 'attendance') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (key === 'leave') return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (key === 'departments') return { from: `${year}-01-01`, to: today };
  return {};
}

/** Only the filters this report understands, with empty ones dropped. */
export function reportParams(key: ReportKey, values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(REPORT_FILTERS[key].map((name) => [name, values[name]]).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

/** `/reports?report=…&…`, the page for a report and its filters. A new filter goes back to page 1. */
export function reportsHref(key: ReportKey, filters: Record<string, string>, page?: number): string {
  const params = new URLSearchParams({ report: key, ...filters });
  if (page && page > 1) params.set('page', String(page));
  return `/reports?${params.toString()}`;
}

/** The download link for one format; the browser sends the session cookie with it. */
export function exportHref(key: ReportKey, filters: Record<string, string>, format: Exclude<ReportFormat, 'json'>): string {
  return `/api/v1/reports/${key}?${new URLSearchParams({ ...filters, format }).toString()}`;
}
