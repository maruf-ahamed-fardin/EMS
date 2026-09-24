'use client';

import { type DataResponse, type ListResponse, NOTIFICATION_POLL_MS, type NotificationItem, type UnreadCount } from '@ems/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/auth/permissions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api-client';
import { NOTIFICATION_KEYS, NotificationList } from './notification-list';

/** "99+" past 99, so the badge never grows wider than the bell. */
export function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/**
 * The header bell (plan §9): asks for the unread count every minute and when the window regains focus,
 * and loads the latest few only when opened. No websockets.
 */
export function NotificationBell() {
  const allowed = useCan('notification.view');
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const unread = useQuery({
    queryKey: NOTIFICATION_KEYS.unread,
    queryFn: async () => (await api<DataResponse<UnreadCount>>('/notifications/unread-count')).data.count,
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnWindowFocus: true,
    enabled: allowed,
  });
  const latest = useQuery({
    queryKey: NOTIFICATION_KEYS.latest,
    queryFn: async () => (await api<ListResponse<NotificationItem>>('/notifications?limit=6')).data,
    enabled: allowed && open,
    staleTime: 0,
  });

  if (!allowed) return null;
  const count = unread.data ?? 0;

  async function markAll() {
    setMarkingAll(true);
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
      // The notifications page, if it is open underneath, is rendered on the server
      router.refresh();
    } catch {
      toast.error('Could not mark them as read. Try again.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}>
          <Bell aria-hidden />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular" aria-hidden>
              {badgeLabel(count)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0" aria-label="Notifications">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void markAll()} disabled={markingAll}>
              {markingAll ? <LoaderCircle className="animate-spin" aria-hidden /> : <CheckCheck aria-hidden />} Mark all read
            </Button>
          )}
        </div>
        {latest.isPending ? (
          <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : latest.isError ? (
          <p className="px-3 py-6 text-sm text-danger-text">Could not load notifications.</p>
        ) : latest.data.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&rsquo;re all caught up.</p>
        ) : (
          <NotificationList items={latest.data} compact onOpen={() => setOpen(false)} />
        )}
        <div className="border-t p-1">
          <Link href="/notifications" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-secondary">
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
