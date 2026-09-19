import { type AttendanceTrend, can, type DashboardOverview, type DataResponse, type MyDay } from '@ems/contracts';
import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  FileWarning,
  KeyRound,
  Plane,
  Plus,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AttendanceTrendChart } from '@/components/dashboard/attendance-trend-chart';
import { DepartmentBars } from '@/components/dashboard/department-bars';
import { PresenceBar } from '@/components/dashboard/presence-bar';
import { StatTile } from '@/components/dashboard/stat-tile';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Tag } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { activitySentence, dhakaHour, greeting, headline, percent, relativeTime } from '@/lib/dashboard';
import { formatDate } from '@/lib/employees';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

const DATE_LINE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Dhaka' });

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const { data: overview } = await serverApiJson<DataResponse<DashboardOverview>>('/dashboard/overview');
  const scope = session.permissions['attendance.view'];
  const trend =
    overview.variant !== 'personal' && (scope === 'ALL' || scope === 'TEAM')
      ? (await serverApiJson<DataResponse<AttendanceTrend>>('/dashboard/attendance-trend?range=week')).data
      : null;

  const now = new Date(overview.generatedAt);
  const firstName = session.name.split(' ')[0] ?? session.name;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {DATE_LINE.format(now)} · {TIME.format(now)}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-[28px]">
          {greeting(dhakaHour(now))}, {firstName}
        </h1>
      </header>

      {overview.variant === 'personal' ? (
        <PersonalDashboard me={overview.me} isWorkingDay={overview.isWorkingDay} lateAfter={overview.lateAfter} />
      ) : (
        <TeamDashboard overview={overview} trend={trend} canCreateEmployee={can(session.permissions, 'employee.create')} canApprove={can(session.permissions, 'leave.approve')} />
      )}
    </div>
  );
}

function TeamDashboard({
  overview,
  trend,
  canCreateEmployee,
  canApprove,
}: {
  overview: DashboardOverview;
  trend: AttendanceTrend | null;
  canCreateEmployee: boolean;
  canApprove: boolean;
}) {
  const a = overview.attendanceToday!;
  const attention = overview.attention!;
  const headcount = overview.headcount!;
  const team = overview.variant === 'team';

  const attentionItems = [
    canApprove && { icon: CalendarDays, label: 'Leave requests', detail: attention.oldestPendingDays ? `Oldest waiting ${attention.oldestPendingDays} ${attention.oldestPendingDays === 1 ? 'day' : 'days'}` : 'Waiting for a decision', count: attention.pendingLeaveRequests, href: '/leave/requests' },
    overview.isWorkingDay && { icon: Clock, label: 'Not checked in', detail: `No check-in and no leave today`, count: attention.notCheckedIn, href: '/attendance' },
    { icon: FileWarning, label: 'Documents expiring', detail: 'Within 30 days', count: attention.documentsExpiringSoon, href: '/documents?expiry=EXPIRING' },
    attention.withoutAccount !== null && { icon: KeyRound, label: 'No sign-in account', detail: 'Active employees who can’t sign in', count: attention.withoutAccount, href: '/employees' },
  ].filter((item): item is { icon: typeof Clock; label: string; detail: string; count: number; href: string } => Boolean(item));

  return (
    <>
      {/* Today */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]" aria-label="Today">
        <div className="rounded-2xl border bg-card p-5 shadow-panel md:p-6">
          <p className="text-lg leading-relaxed text-balance md:text-xl">
            {headline(overview).map((part, index) =>
              part.strong ? (
                <strong key={index} className="font-semibold">
                  {part.text}
                </strong>
              ) : (
                <span key={index} className="text-muted-foreground">
                  {part.text}
                </span>
              ),
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canApprove && (
              <Button asChild variant="outline" className="h-10">
                <Link href="/leave/requests">
                  <CalendarDays aria-hidden /> Review leave
                </Link>
              </Button>
            )}
            {canCreateEmployee && (
              <Button asChild variant="outline" className="h-10">
                <Link href="/employees/new">
                  <Plus aria-hidden /> Add employee
                </Link>
              </Button>
            )}
          </div>

          <div className="mt-6 border-t pt-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted-foreground">{team ? 'Your team today' : 'Everyone today'}</p>
              <p className="text-sm text-muted-foreground">
                Late after <span className="font-medium text-foreground tabular">{overview.lateAfter}</span>
              </p>
            </div>
            {overview.isWorkingDay ? (
              <>
                <p className="mb-3 text-4xl font-bold tracking-tight tabular">
                  {percent(a.present, a.expected)}
                  <span className="ml-2 text-base font-medium text-muted-foreground">in today</span>
                </p>
                <PresenceBar attendance={a} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Today isn&rsquo;t a working day, so nobody is expected in.</p>
            )}
          </div>
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-panel" aria-labelledby="attention-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="attention-title" className="font-semibold">
              Needs your attention
            </h2>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground tabular">
              {attentionItems.filter((i) => i.count > 0).length}
            </span>
          </div>
          <ul className="grid gap-1">
            {attentionItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', item.count > 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <span className={cn('text-lg font-bold tabular', item.count === 0 && 'text-muted-foreground')}>{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4" aria-label="Key numbers">
        <StatTile icon={Users} label={team ? 'Team members' : 'Employees'} value={headcount.total} context={`${headcount.joinedThisMonth} joined this month`} href="/employees" />
        <StatTile icon={UserCheck} label="Present today" value={a.present} context={overview.isWorkingDay ? `${a.late} late · ${percent(a.present, a.expected)} of expected` : 'Not a working day'} />
        <StatTile icon={Plane} label="On leave today" value={a.onLeave} context={canApprove ? `${attention.pendingLeaveRequests} requests pending` : undefined} />
        <StatTile icon={UserRoundX} label="Not checked in" value={a.notCheckedIn} context={overview.isWorkingDay ? `After ${overview.lateAfter} counts as late` : 'Not a working day'} />
      </section>

      {/* Trend and departments */}
      <section className={cn('grid gap-4', !team && 'lg:grid-cols-[1.6fr_1fr]')}>
        {trend && (
          <div className="rounded-2xl border bg-card p-5 shadow-panel">
            <h2 className="font-semibold">Attendance overview</h2>
            <p className="mb-4 text-sm text-muted-foreground">People checked in on each working day</p>
            <AttendanceTrendChart initial={trend} />
          </div>
        )}
        {!team && (
          <div className="rounded-2xl border bg-card p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Departments</h2>
              <Link href="/departments" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Manage <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <DepartmentBars departments={headcount.byDepartment} />
            {overview.outToday && overview.outToday.total > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-sm text-muted-foreground">Out today</p>
                <div className="flex items-center">
                  {overview.outToday.people.map((person, index) => (
                    <Link key={person.id} href={`/employees/${person.id}`} title={person.name} className={cn('rounded-full ring-2 ring-card', index > 0 && '-ml-2')}>
                      <PersonAvatar name={person.name} size="sm" />
                      <span className="sr-only">{person.name}</span>
                    </Link>
                  ))}
                  {overview.outToday.total > overview.outToday.people.length && (
                    <span className="ml-2 text-sm text-muted-foreground">+{overview.outToday.total - overview.outToday.people.length}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Lists */}
      <section className="grid gap-4 lg:grid-cols-3">
        {canApprove && (
          <Panel title="Leave requests" href="/leave/requests" linkLabel="Open queue">
            {overview.pendingLeave.length === 0 ? (
              <Empty>Nothing waiting for a decision.</Empty>
            ) : (
              <ul className="grid gap-3">
                {overview.pendingLeave.map((request) => (
                  <li key={request.id} className="flex items-center gap-3">
                    <PersonAvatar name={request.employee.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{request.employee.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {request.leaveType} · {formatRange(request.startDate, request.endDate)} · {request.days} {request.days === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="New joiners" href="/employees?sort=-joined" linkLabel="All">
          {overview.newJoiners.length === 0 ? (
            <Empty>No one has joined yet.</Empty>
          ) : (
            <ul className="grid gap-3">
              {overview.newJoiners.map((person) => (
                <li key={person.id}>
                  <Link href={`/employees/${person.id}`} className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <PersonAvatar name={person.fullName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium hover:underline">{person.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{person.position.title}</p>
                    </div>
                    <div className="text-right">
                      <Tag>{person.department.name}</Tag>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(person.joiningDate)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Activity" href={overview.variant === 'organization' ? '/audit-logs' : undefined} linkLabel="Audit log">
          {overview.activity.length === 0 ? (
            <Empty>No recent changes.</Empty>
          ) : (
            <ol className="grid gap-3">
              {overview.activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-1" aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">{item.actor ?? 'System'}</span> <span className="text-muted-foreground">{activitySentence(item)}</span>
                  </p>
                  <time dateTime={item.createdAt} className="shrink-0 text-xs text-muted-foreground tabular">
                    {relativeTime(item.createdAt, new Date(overview.generatedAt))}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </section>

      {overview.me && <MyDayStrip me={overview.me} />}
    </>
  );
}

function PersonalDashboard({ me, isWorkingDay, lateAfter }: { me: MyDay | null; isWorkingDay: boolean; lateAfter: string }) {
  if (!me) {
    return <Panel title="Your day"><Empty>No employee record is linked to your account yet, so there is nothing to show here. Ask HR if you expected one.</Empty></Panel>;
  }
  const status = me.attendanceToday;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Panel title="Today" href="/attendance" linkLabel="Attendance">
        {me.onLeaveToday ? (
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Plane className="size-5 text-muted-foreground" aria-hidden /> You&rsquo;re on leave today
          </p>
        ) : !isWorkingDay ? (
          <p className="text-lg font-semibold">Not a working day. Enjoy it.</p>
        ) : status?.firstInAt ? (
          <div>
            <p className="text-lg font-semibold">
              Checked in at {TIME.format(new Date(status.firstInAt))}
              {status.status === 'LATE' && <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 align-middle text-xs font-medium text-warning-text">Late</span>}
            </p>
            <p className="text-sm text-muted-foreground">{status.lastOutAt ? `Checked out at ${TIME.format(new Date(status.lastOutAt))}` : 'Still checked in'}</p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-semibold">You haven&rsquo;t checked in yet</p>
            <p className="text-sm text-muted-foreground">Check-ins after {lateAfter} count as late. Checking in arrives with attendance (Phase 6).</p>
          </div>
        )}
      </Panel>

      <Panel title="Leave balance" href="/leave" linkLabel="Request leave">
        <MyBalances me={me} />
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Your requests" href="/leave" linkLabel="All">
          {me.pendingRequests.length === 0 ? (
            <Empty>No pending or upcoming leave.</Empty>
          ) : (
            <ul className="grid gap-2">
              {me.pendingRequests.map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{request.leaveType}</span>
                    <span className="text-muted-foreground">
                      {formatRange(request.startDate, request.endDate)} · {request.days} {request.days === 1 ? 'day' : 'days'}
                    </span>
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', request.status === 'PENDING' ? 'bg-warning/15 text-warning-text' : 'bg-success/12 text-success-text')}>
                    {request.status === 'PENDING' ? 'Waiting' : 'Approved'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MyBalances({ me }: { me: MyDay }) {
  if (me.leaveBalances.length === 0) return <Empty>No leave balances for this year yet.</Empty>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {me.leaveBalances.map((balance) => (
        <li key={balance.leaveType}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-medium">{balance.leaveType}</span>
            <span className="text-muted-foreground tabular">
              <span className="text-base font-semibold text-foreground">{balance.available}</span> of {balance.allocated} left
            </span>
          </div>
          {/* A meter: used and pending against the allowance, on the same-hue track */}
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${balance.used} used, ${balance.pending} pending, ${balance.available} available`}>
            {balance.used > 0 && <div className="h-full rounded-l-full bg-chart-1" style={{ width: `${(balance.used / Math.max(balance.allocated, 1)) * 100}%` }} />}
            {balance.pending > 0 && <div className="h-full bg-chart-1/45" style={{ width: `${(balance.pending / Math.max(balance.allocated, 1)) * 100}%` }} />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {balance.used} used{balance.pending > 0 ? ` · ${balance.pending} pending` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

function MyDayStrip({ me }: { me: MyDay }) {
  return (
    <Panel title="Your leave" href="/leave" linkLabel="Request leave">
      <MyBalances me={me} />
    </Panel>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {href && linkLabel && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {linkLabel} <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function formatRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}
