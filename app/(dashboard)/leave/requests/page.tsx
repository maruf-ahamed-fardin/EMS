import { can, type LeaveRequestItem, leaveRequestListQuery, type ListResponse } from '@/lib/validations';
import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LeaveRequestActions } from '@/components/leave/leave-request-actions';
import { LeaveStatusBadge } from '@/components/leave/leave-status-badge';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatePanel } from '@/components/shared/state-panel';
import { Tag } from '@/components/shared/status-badge';
import { relativeTime } from '@/lib/client/dashboard';
import { daysLabel, formatLeaveRange } from '@/lib/client/leave';
import { redirectPastLastPage } from '@/lib/client/pagination';
import { parseSearchParams } from '@/lib/client/search-params';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Leave requests' };

const VIEWS = [
  { key: 'waiting', label: 'Waiting for you', query: 'reviewable=true' },
  { key: 'approved', label: 'Approved', query: 'status=APPROVED' },
  { key: 'rejected', label: 'Rejected', query: 'status=REJECTED' },
  { key: 'all', label: 'All', query: '' },
] as const;

export default async function LeaveRequestsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'leave.approve')) return <Forbidden />;

  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.view) ?? VIEWS[0];
  const page = parseSearchParams(leaveRequestListQuery, { page: params.page }).page;
  const list = await serverApiJson<ListResponse<LeaveRequestItem>>(`/leave/requests?limit=20&page=${page}${view.query ? `&${view.query}` : ''}`);

  redirectPastLastPage(list.meta, (p) => `/leave/requests?${view.key !== 'waiting' ? `view=${view.key}&` : ''}page=${p}`);
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Leave requests" description={view.key === 'waiting' ? `${list.meta.total} waiting for a decision, oldest first` : `${list.meta.total} requests`} />

      <nav aria-label="Views" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === 'waiting' ? '/leave/requests' : `/leave/requests?view=${v.key}`}
            aria-current={v.key === view.key ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium hover:bg-secondary',
              v.key === view.key && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {list.data.length === 0 ? (
        <StatePanel icon={Inbox} title={view.key === 'waiting' ? 'Nothing waiting for you' : 'No requests here'} description={view.key === 'waiting' ? 'New requests from your team will appear here.' : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {list.data.map((r) => (
            <article key={r.id} className="rounded-2xl border bg-card p-4 shadow-panel md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-3">
                  <PersonAvatar name={r.employee.name} />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <Link href={`/employees/${r.employee.id}?tab=leave`} className="hover:underline">
                        {r.employee.name}
                      </Link>{' '}
                      <span className="font-normal text-muted-foreground">· {r.employee.departmentName}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                      <Tag>{r.leaveType.name}</Tag>
                      <span className="tabular">{formatLeaveRange(r.startDate, r.endDate)}</span>
                      <span className="text-muted-foreground">· {daysLabel(r.days)}</span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">&ldquo;{r.reason}&rdquo;</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Requested {requestedWhen(r.requestedAt)}
                      {r.balanceAvailable !== null && r.status === 'PENDING' && ` · ${r.balanceAvailable} ${r.leaveType.name.toLowerCase()} days left after the days already waiting`}
                      {r.reviewedBy && ` · ${r.status === 'CANCELLED' ? 'Cancelled' : `Decided by ${r.reviewedBy}`}`}
                    </p>
                    {r.reviewNote && <p className="mt-1 text-sm">Note: {r.reviewNote}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <LeaveStatusBadge status={r.status} />
                  <LeaveRequestActions request={r} />
                </div>
              </div>
            </article>
          ))}
          <div className="rounded-2xl border bg-card shadow-panel">
            <Pagination meta={list.meta} noun="requests" hrefFor={(p) => `/leave/requests?${view.key !== 'waiting' ? `view=${view.key}&` : ''}page=${p}`} />
          </div>
        </div>
      )}
    </div>
  );
}

/** "just now", "3h ago", "on 17 Sep": relativeTime's short forms read as a sentence. */
function requestedWhen(iso: string): string {
  const when = relativeTime(iso);
  if (when === 'now') return 'just now';
  return /^\d+[mhd]$/.test(when) ? `${when} ago` : `on ${when}`;
}
