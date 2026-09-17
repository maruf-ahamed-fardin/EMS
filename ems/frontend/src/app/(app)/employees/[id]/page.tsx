import type { AttendanceItem, AttendanceSummary, DataResponse, EmployeeActivityItem, EmployeeDetail, ListResponse } from '@ems/contracts';
import { AttendanceStatusBadge } from '@/components/attendance/attendance-status-badge';
import { dhakaToday, formatDuration, formatTime, monthStartOf } from '@/lib/attendance';
import { percent } from '@/lib/dashboard';
import { ChevronRight, History, Lock, Pencil, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatusBadge, Tag } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiRequestError } from '@/lib/api-error';
import { describeActivity, EMPLOYMENT_TYPE_LABELS, formatDate, formatDateTime, formatPhone, GENDER_LABELS } from '@/lib/employees';
import { serverApiJson } from '@/lib/server-api';
import { EmployeeActions } from './employee-actions';

export const metadata: Metadata = { title: 'Employee' };

const TABS = ['overview', 'personal', 'employment', 'attendance', 'activity'] as const;

/** This month's attendance, or null when the viewer can't see this person's attendance. */
async function loadAttendance(id: string) {
  const to = dhakaToday();
  const from = monthStartOf(to);
  try {
    const [summary, recent] = await Promise.all([
      serverApiJson<DataResponse<AttendanceSummary>>(`/attendance/summary?from=${from}&to=${to}&employeeId=${id}`),
      serverApiJson<ListResponse<AttendanceItem>>(`/attendance?employeeId=${id}&limit=10`),
    ]);
    return { summary: summary.data, recent: recent.data };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) return null;
    throw error;
  }
}

async function load(id: string) {
  try {
    const [detail, activity, attendance] = await Promise.all([
      serverApiJson<DataResponse<EmployeeDetail>>(`/employees/${encodeURIComponent(id)}`),
      serverApiJson<ListResponse<EmployeeActivityItem>>(`/employees/${encodeURIComponent(id)}/activity?limit=20`),
      loadAttendance(encodeURIComponent(id)),
    ]);
    return { employee: detail.data, activity: activity.data, attendance };
  } catch (error) {
    // Out of scope and missing look the same, on purpose
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
}

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { employee, activity, attendance } = await load(id);
  const initialTab = (TABS as readonly string[]).includes(tab ?? '') ? tab! : 'overview';

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/employees" className="hover:text-foreground hover:underline">
          Employees
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">
          {employee.fullName}
        </span>
      </nav>

      <section className="rounded-2xl border bg-card p-5 shadow-panel md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <PersonAvatar name={employee.fullName} size="xl" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{employee.fullName}</h1>
              <p className="text-muted-foreground">
                <span className="font-mono text-sm">{employee.employeeCode}</span> · {employee.position.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Tag>{employee.department.name}</Tag>
                <StatusBadge status={employee.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {employee.allowedActions.update && (
              <Button asChild variant="outline" className="h-10">
                <Link href={`/employees/${employee.id}/edit`}>
                  <Pencil aria-hidden /> Edit
                </Link>
              </Button>
            )}
            <EmployeeActions employee={{ id: employee.id, fullName: employee.fullName, allowedActions: employee.allowedActions }} />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="Manager">
            {employee.manager ? (
              <Link href={`/employees/${employee.manager.id}`} className="hover:underline">
                {employee.manager.name}
              </Link>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label="Joined">{formatDate(employee.joiningDate)}</Fact>
          <Fact label="Employment">{EMPLOYMENT_TYPE_LABELS[employee.employmentType]}</Fact>
          <Fact label="Location">{employee.workLocation}</Fact>
          <Fact label="Phone">
            <a href={`tel:${employee.phone}`} className="hover:underline">
              {formatPhone(employee.phone)}
            </a>
          </Fact>
        </dl>
      </section>

      <Tabs defaultValue={initialTab} className="mt-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          {attendance && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Contact">
            <Rows
              rows={[
                ['Work email', <a key="email" href={`mailto:${employee.email}`} className="hover:underline">{employee.email}</a>],
                ['Phone', formatPhone(employee.phone)],
                ['Direct reports', String(employee.directReportCount)],
              ]}
            />
          </Panel>
          <PrivatePanel employee={employee} />
          {employee.account && (
            <Panel title="Sign-in account">
              <Rows
                rows={[
                  ['Role', employee.account.role.name],
                  ['Status', employee.account.status.toLowerCase().replace(/^./, (c) => c.toUpperCase())],
                  ['Last sign-in', employee.account.lastLoginAt ? formatDateTime(employee.account.lastLoginAt) : 'Never'],
                ]}
              />
            </Panel>
          )}
          <Panel title="Recent activity" action={<Link href="?tab=activity" className="text-sm font-medium text-primary hover:underline">All</Link>}>
            <ActivityList items={activity.slice(0, 4)} />
          </Panel>
        </TabsContent>

        <TabsContent value="personal" className="mt-4 grid gap-4 lg:grid-cols-2">
          <PrivatePanel employee={employee} />
          <Panel title="Identity">
            <Rows
              rows={[
                ['Full name', employee.fullName],
                ['Gender', employee.gender ? GENDER_LABELS[employee.gender] : 'Not recorded'],
              ]}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="employment" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Role">
            <Rows
              rows={[
                ['Employee ID', employee.employeeCode],
                ['Department', employee.department.name],
                ['Position', employee.position.title],
                ['Manager', employee.manager?.name ?? '—'],
              ]}
            />
          </Panel>
          <Panel title="Terms">
            <Rows
              rows={[
                ['Employment type', EMPLOYMENT_TYPE_LABELS[employee.employmentType]],
                ['Joining date', formatDate(employee.joiningDate)],
                ['Work location', employee.workLocation],
                ['Status', employee.status === 'ACTIVE' ? 'Active' : `Inactive${employee.deactivatedAt ? ` since ${formatDateTime(employee.deactivatedAt)}` : ''}`],
              ]}
            />
          </Panel>
        </TabsContent>

        {attendance && (
          <TabsContent value="attendance" className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <Panel title="This month">
              <Rows
                rows={[
                  ['Present', `${attendance.summary.byStatus.PRESENT + attendance.summary.byStatus.LATE} days (${percent(attendance.summary.byStatus.PRESENT + attendance.summary.byStatus.LATE, attendance.summary.byStatus.PRESENT + attendance.summary.byStatus.LATE + attendance.summary.byStatus.ABSENT)})`],
                  ['Late', `${attendance.summary.byStatus.LATE} days · ${formatDuration(attendance.summary.totalLateMinutes)}`],
                  ['Absent', `${attendance.summary.byStatus.ABSENT} days`],
                  ['On leave', `${attendance.summary.byStatus.ON_LEAVE} days`],
                  ['Average day', formatDuration(attendance.summary.averageWorkedMinutes)],
                ]}
              />
            </Panel>
            <Panel title="Recent days" action={<Link href={`/attendance?employeeId=${employee.id}`} className="text-sm font-medium text-primary hover:underline">All</Link>}>
              {attendance.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
              ) : (
                <ul className="divide-y">
                  {attendance.recent.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="w-28 shrink-0 tabular">{formatDate(row.workDate)}</span>
                      <AttendanceStatusBadge status={row.status} />
                      <span className="ml-auto text-muted-foreground tabular">
                        {formatTime(row.firstInAt)} – {formatTime(row.lastOutAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </TabsContent>
        )}

        <TabsContent value="activity" className="mt-4">
          <Panel title="Activity">
            <ActivityList items={activity} />
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{children}</dd>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[140px_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrivatePanel({ employee }: { employee: EmployeeDetail }) {
  const details = employee.private;
  return (
    <Panel
      title="Personal details"
      action={
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Private
        </span>
      }
    >
      {details ? (
        <Rows
          rows={[
            ['Date of birth', formatDate(details.dateOfBirth)],
            ['Address', [details.address.line1, details.address.line2, details.address.city, details.address.postcode, details.address.country].filter(Boolean).join(', ')],
            ['Emergency contact', `${details.emergencyContact.name} (${details.emergencyContact.relationship.toLowerCase()}) · ${formatPhone(details.emergencyContact.phone)}`],
          ]}
        />
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Birth date, address and emergency contact are private. Your role doesn&rsquo;t include access to them.
        </p>
      )}
    </Panel>
  );
}

function ActivityList({ items }: { items: EmployeeActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden /> No activity recorded yet.
      </p>
    );
  }
  return (
    <ol className="grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
          <div className="min-w-0">
            <p>
              <span className="font-semibold">{item.actor ?? 'System'}</span> {describeActivity(item.action, item.changedFields)}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
