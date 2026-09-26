import { EMPLOYEE_STATUS_LABELS, type EmploymentType, type Gender } from '@/lib/validations';

// Shared with the reports, so both use the same words
export { EMPLOYMENT_TYPE_LABELS } from '@/lib/validations';

export const EMPLOYMENT_TYPE_HINTS: Record<EmploymentType, string> = {
  FULL_TIME: 'Permanent, 40 h',
  PART_TIME: 'Fewer hours',
  CONTRACT: 'Fixed end date',
  INTERN: 'Up to 6 months',
};

export const STATUS_LABELS = EMPLOYEE_STATUS_LABELS;

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  OTHER: 'Other',
  UNDISCLOSED: 'Prefer not to say',
};

// Fixed names: ICU versions disagree on en-GB's short September ("Sep" or "Sept")
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateTimeParts = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Dhaka',
});

/** `2026-09-21` → `21 Sep 2026`. Read straight from the string, so a calendar date never shifts a day. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** An instant in Dhaka time: `21 Sep 2026, 09:03`. */
export function formatDateTime(iso: string): string {
  const parts = Object.fromEntries(dateTimeParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${formatDate(`${parts.year}-${parts.month}-${parts.day}`)}, ${parts.hour}:${parts.minute}`;
}

/** The Dhaka date of an instant (a `createdAt`, say): `21 Sep 2026`. formatDate would show the UTC date. */
export function formatInstantDate(iso: string): string {
  const parts = Object.fromEntries(dateTimeParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return formatDate(`${parts.year}-${parts.month}-${parts.day}`);
}

/** `+8801711204318` → `+880 1711-204318`; other numbers are left as entered. */
export function formatPhone(phone: string): string {
  const match = /^\+880(\d{4})(\d{6})$/.exec(phone);
  return match ? `+880 ${match[1]}-${match[2]}` : phone;
}

/** Today in Dhaka as YYYY-MM-DD, minus `days`. */
export function dhakaDateDaysAgo(days: number, now = new Date()): string {
  const shifted = new Date(now.getTime() - days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(shifted);
}

const ACTION_LABELS: Record<string, string> = {
  'employee.created': 'created the record',
  'employee.updated': 'updated',
  'employee.deactivated': 'deactivated the employee',
  'employee.reactivated': 'reactivated the employee',
  'employee.deleted': 'deleted the record',
};

const FIELD_LABELS: Record<string, string> = {
  employeeCode: 'employee ID',
  firstName: 'first name',
  lastName: 'last name',
  dateOfBirth: 'date of birth',
  emergencyContact: 'emergency contact',
  departmentId: 'department',
  positionId: 'position',
  managerId: 'manager',
  joiningDate: 'joining date',
  employmentType: 'employment type',
  workLocation: 'work location',
};

/** "updated phone and work location" from an activity entry. */
export function describeActivity(action: string, changedFields: string[]): string {
  const label = ACTION_LABELS[action] ?? action.replace(/^[a-z]+\./, '').replaceAll('_', ' ');
  if (action !== 'employee.updated' || changedFields.length === 0) return label;
  const names = changedFields.map((field) => FIELD_LABELS[field] ?? field);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return `${label} ${list}`;
}

/**
 * The URL for the list with some parameters changed. Changing a filter resets to page 1, so a filter
 * never lands on an empty page 7.
 */
export function employeesHref(current: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  if (!('page' in changes)) delete merged.page;
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/employees?${query}` : '/employees';
}
