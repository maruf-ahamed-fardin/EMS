import type { LeaveRequestStatus } from '@ems/contracts';
import { formatDate } from './employees';

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** "24 Sep 2026" or "24 Sep – 28 Sep 2026" or across years in full. */
export function formatLeaveRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDate(start).replace(/ \d{4}$/, '')} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function daysLabel(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
