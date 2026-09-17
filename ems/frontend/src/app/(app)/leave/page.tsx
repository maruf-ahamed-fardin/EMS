import { can, type DataResponse, type HolidayItem, type LeaveBalanceRow, type LeaveRequestItem, type LeaveTypeItem, type ListResponse } from '@ems/contracts';
import { CalendarDays, Sun } from 'lucide-react';
import type { Metadata } from 'next';
import { LeaveBalanceCards } from '@/components/leave/leave-balance-cards';
import { LeaveRequestActions } from '@/components/leave/leave-request-actions';
import { LeaveStatusBadge } from '@/components/leave/leave-status-badge';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { StatePanel } from '@/components/shared/state-panel';
import { dhakaToday } from '@/lib/attendance';
import { formatDate } from '@/lib/employees';
import { daysLabel, formatLeaveRange } from '@/lib/leave';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { LeaveRequestForm } from './leave-request-form';

export const metadata: Metadata = { title: 'Leave' };

export default async function LeavePage() {
  const session = await getSession();
  if (!session || !can(session.permissions, 'leave.create')) return <Forbidden />;
  if (!session.employeeId) {
    return (
      <>
        <PageHeader title="Leave" />
        <StatePanel icon={CalendarDays} title="No employee record is linked to your account" description="Leave belongs to an employee record. Ask HR to link yours." />
      </>
    );
  }

  const today = dhakaToday();
  const year = Number(today.slice(0, 4));
  const [{ data: balances }, { data: types }, requests, { data: holidays }] = await Promise.all([
    serverApiJson<DataResponse<LeaveBalanceRow[]>>(`/leave/balances?year=${year}`),
    serverApiJson<DataResponse<LeaveTypeItem[]>>('/leave/types'),
    serverApiJson<ListResponse<LeaveRequestItem>>('/leave/requests?mine=true&limit=50'),
    serverApiJson<DataResponse<HolidayItem[]>>(`/holidays?year=${year}`),
  ]);
  const upcomingHolidays = holidays.filter((h) => h.date >= today).slice(0, 5);

  return (
    <div className="grid gap-6">
      <PageHeader title="Leave" description={`Your balances and requests for ${year}`} />

      <section aria-label="Balances">
        <LeaveBalanceCards balances={balances} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="h-fit rounded-2xl border bg-card p-5 shadow-panel" aria-labelledby="request-title">
          <h2 id="request-title" className="mb-4 font-semibold">
            Request leave
          </h2>
          <LeaveRequestForm types={types} />
          {upcomingHolidays.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Sun className="size-4 text-muted-foreground" aria-hidden /> Upcoming holidays
              </p>
              <ul className="grid gap-1 text-sm">
                {upcomingHolidays.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 text-muted-foreground">
                    <span>{h.name}</span>
                    <span className="tabular">{formatDate(h.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card shadow-panel" aria-labelledby="mine-title">
          <h2 id="mine-title" className="border-b px-5 py-4 font-semibold">
            Your requests
          </h2>
          {requests.data.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">You haven&rsquo;t requested any leave yet.</p>
          ) : (
            <ul className="divide-y">
              {requests.data.map((r) => (
                <li key={r.id} className="grid gap-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.leaveType.name} · <span className="tabular">{formatLeaveRange(r.startDate, r.endDate)}</span>
                    </p>
                    <LeaveStatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {daysLabel(r.days)} · {r.reason}
                  </p>
                  {r.reviewNote && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{r.reviewedBy ?? 'Reviewer'}:</span> {r.reviewNote}
                    </p>
                  )}
                  <LeaveRequestActions request={r} compact />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
