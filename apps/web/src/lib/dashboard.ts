import type { ActivityItem, DashboardOverview } from '@ems/contracts';
import { formatDate } from './employees';

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function dhakaHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Dhaka' }).format(now));
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The dashboard's opening sentence, split into parts so the numbers can be emphasized:
 * "49 of 60 people are in today. 3 leave requests are waiting on you, and 5 people haven't checked in yet."
 */
export function headline(overview: DashboardOverview): Array<{ text: string; strong?: boolean }> {
  const a = overview.attendanceToday;
  const attention = overview.attention;
  if (!a || !attention) return [];
  if (!overview.isWorkingDay) {
    return [{ text: 'Today is not a working day' }, { text: attention.pendingLeaveRequests > 0 ? `, but ` : '.' }, ...pendingPart(attention.pendingLeaveRequests, true)];
  }

  const parts: Array<{ text: string; strong?: boolean }> = [
    { text: `${a.present} of ${a.expected}`, strong: true },
    { text: ` ${a.expected === 1 ? 'person is' : 'people are'} in today.` },
  ];
  const waiting = attention.pendingLeaveRequests;
  const missing = a.notCheckedIn;
  if (waiting > 0 && missing > 0) {
    parts.push(...pendingPart(waiting, false), { text: ', and ' }, { text: plural(missing, 'person', 'people'), strong: true }, { text: ` ${missing === 1 ? "hasn't" : "haven't"} checked in yet.` });
  } else if (waiting > 0) {
    parts.push(...pendingPart(waiting, false), { text: '.' });
  } else if (missing > 0) {
    parts.push({ text: ' ' }, { text: plural(missing, 'person', 'people'), strong: true }, { text: ` ${missing === 1 ? "hasn't" : "haven't"} checked in yet.` });
  } else {
    parts.push({ text: ' Nothing is waiting on you.' });
  }
  return parts;
}

function pendingPart(count: number, standalone: boolean): Array<{ text: string; strong?: boolean }> {
  if (count === 0) return [];
  return [
    { text: standalone ? '' : ' ' },
    { text: plural(count, 'leave request', 'leave requests'), strong: true },
    { text: ` ${count === 1 ? 'is' : 'are'} waiting on you${standalone ? '.' : ''}` },
  ];
}

/** "12m", "3h", "2d", "17 Sep" for older entries. */
export function relativeTime(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  // Fixed month names (see formatDate): ICU may print "Sept"
  const dhakaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(iso));
  return formatDate(dhakaDay).replace(/ \d{4}$/, '');
}

const ACTIONS: Record<string, (subject: string) => string> = {
  'employee.created': (s) => `added ${s}`,
  'employee.updated': (s) => `updated ${s}'s record`,
  'employee.deactivated': (s) => `deactivated ${s}`,
  'employee.reactivated': (s) => `reactivated ${s}`,
  'employee.deleted': () => 'deleted an employee record',
  'user.created': () => 'created a sign-in account',
  'department.created': () => 'created a department',
  'department.updated': () => 'updated a department',
  'department.deleted': () => 'deleted a department',
  'position.created': () => 'added a position',
  'position.updated': () => 'updated a position',
  'position.deleted': () => 'deleted a position',
};

/** "added Rahim Ahmed", from an activity entry. Unknown actions still read sensibly. */
export function activitySentence(item: ActivityItem): string {
  const subject = item.subject?.name ?? 'someone';
  const describe = ACTIONS[item.action];
  if (describe) return describe(subject);
  const [entity, verb] = item.action.split('.');
  return `${(verb ?? item.action).replaceAll('_', ' ')} ${entity === 'employee' ? subject : `a ${entity}`}`;
}

/** Share of `part` in `whole` as a whole-number percentage string, or "—". */
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—';
}
