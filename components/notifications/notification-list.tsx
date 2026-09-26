'use client';

import type { NotificationItem, NotificationType } from '@/lib/validations';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, FileWarning, KeyRound, Plane, UserPlus, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api-client';
import { relativeTime } from '@/lib/client/dashboard';
import { cn } from '@/lib/client/utils';

const ICONS: Record<NotificationType, LucideIcon> = {
  'leave.requested': Plane,
  'leave.approved': Plane,
  'leave.rejected': Plane,
  'document.expiring': FileWarning,
  'employee.created': UserPlus,
  'attendance.issues': CalendarCheck,
  'auth.password_changed': KeyRound,
};

/** The query keys every notification view shares, so reading one updates the bell and the page. */
export const NOTIFICATION_KEYS = { all: ['notifications'] as const, unread: ['notifications', 'unread-count'] as const, latest: ['notifications', 'latest'] as const };

/**
 * Notifications as a list of buttons: opening one marks it read and goes where it points. Unread ones
 * are bold with a dot, and say so to screen readers.
 */
export function NotificationList({ items, compact = false, onOpen }: { items: NotificationItem[]; compact?: boolean; onOpen?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function open(item: NotificationItem) {
    onOpen?.();
    if (!item.readAt) {
      // Reading shouldn't block going there; a failure only leaves it unread
      await api(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    }
    if (item.link) router.push(item.link);
    router.refresh();
  }

  return (
    <ul className={cn('divide-y', compact && 'max-h-96 overflow-y-auto')}>
      {items.map((item) => {
        const Icon = ICONS[item.type] ?? CalendarCheck;
        const unread = !item.readAt;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => void open(item)}
              className={cn('flex w-full items-start gap-3 text-left outline-none hover:bg-secondary/60 focus-visible:bg-secondary', compact ? 'px-3 py-2.5' : 'px-4 py-3 md:px-5')}
            >
              <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', unread ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', unread ? 'font-semibold' : 'text-foreground/90')}>
                  {unread && <span className="sr-only">Unread: </span>}
                  {item.title}
                </span>
                <span className={cn('mt-0.5 block text-xs text-muted-foreground', compact && 'line-clamp-2')}>{item.body}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <time dateTime={item.createdAt} className="text-xs text-muted-foreground tabular">
                  {relativeTime(item.createdAt)}
                </time>
                {unread && <span className="size-2 rounded-full bg-primary" aria-hidden />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
