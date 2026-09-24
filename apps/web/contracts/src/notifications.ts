import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './api';

/** Every kind of notification (plan §9). Stored in `notifications.type`. */
export const NOTIFICATION_TYPES = {
  'leave.requested': 'Leave waiting for your decision',
  'leave.approved': 'Your leave was approved',
  'leave.rejected': 'Your leave was rejected',
  'document.expiring': 'A document is about to expire',
  'employee.created': 'Someone new joined',
  'attendance.issues': 'Absences or missing check-outs',
  'auth.password_changed': 'Your password changed',
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Where the notification leads in the app, such as `/leave/requests`. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type NotificationListQuery = z.infer<typeof notificationListQuery>;

export interface UnreadCount {
  count: number;
}

/** How often the header bell asks for the unread count (plan §9); it also asks when the window regains focus. */
export const NOTIFICATION_POLL_MS = 60_000;
