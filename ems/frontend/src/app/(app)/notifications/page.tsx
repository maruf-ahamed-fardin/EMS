import { can, type DataResponse, type ListResponse, type NotificationItem, notificationListQuery, type UnreadCount } from '@ems/contracts';
import { BellOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read-button';
import { NotificationList } from '@/components/notifications/notification-list';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };

const href = (unread: boolean, page = 1) => {
  const params = new URLSearchParams();
  if (unread) params.set('unread', 'true');
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/notifications?${query}` : '/notifications';
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string; page?: string }> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'notification.view')) return <Forbidden />;

  const query = notificationListQuery.parse({ ...(await searchParams), limit: 20 });
  const [list, unread] = await Promise.all([
    serverApiJson<ListResponse<NotificationItem>>(`/notifications?limit=20&page=${query.page}${query.unread ? '&unread=true' : ''}`),
    serverApiJson<DataResponse<UnreadCount>>('/notifications/unread-count'),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Notifications"
        description={unread.data.count > 0 ? `${unread.data.count} unread` : 'You’re all caught up.'}
        actions={unread.data.count > 0 && <MarkAllReadButton />}
      />

      <nav aria-label="Views" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {[
          { label: 'All', unread: false },
          { label: `Unread${unread.data.count > 0 ? ` (${unread.data.count})` : ''}`, unread: true },
        ].map((v) => (
          <Link
            key={v.label}
            href={href(v.unread)}
            aria-current={v.unread === query.unread ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium hover:bg-secondary',
              v.unread === query.unread && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {list.data.length === 0 ? (
        <StatePanel
          icon={BellOff}
          title={query.unread ? 'Nothing unread' : 'No notifications yet'}
          description="Leave decisions, expiring documents and other things that need you will show up here."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-panel" aria-label="Notifications">
          <NotificationList items={list.data} />
          <div className="border-t">
            <Pagination meta={list.meta} noun="notifications" hrefFor={(page) => href(query.unread, page)} />
          </div>
        </section>
      )}
    </div>
  );
}
