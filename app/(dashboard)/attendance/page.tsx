import {
  type AttendanceItem,
  attendanceListQuery,
  type AttendanceSummary,
  can,
  type DataResponse,
  type DepartmentListItem,
  type EmployeeListItem,
  type ListResponse,
  type MyAttendanceToday,
} from '@/lib/validations';
import { CalendarCheck, CalendarX2, Clock, Timer } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AttendanceStatusBadge } from '@/components/attendance/attendance-status-badge';
import { CheckInCard } from '@/components/attendance/check-in-card';
import { CorrectionDialog } from '@/components/attendance/correction-dialog';
import { StatTile } from '@/components/dashboard/stat-tile';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/client/api-error';
import { attendanceHref, dhakaToday, formatDuration, formatTime, monthStartOf } from '@/lib/client/attendance';
import { percent } from '@/lib/client/dashboard';
import { formatDate } from '@/lib/client/employees';
import { redirectPastLastPage } from '@/lib/client/pagination';
import { parseSearchParams } from '@/lib/client/search-params';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/client/session';
import { AttendanceFilters } from './attendance-filters';

export const metadata: Metadata = { title: 'Attendance' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) return <Forbidden />;
  const canSelf = can(session.permissions, 'attendance.self');
  const viewScope = session.permissions['attendance.view'];
  if (!canSelf && !viewScope) return <Forbidden />;

  const params = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const today = dhakaToday();
  // Default to this month so the page opens on something useful
  const isDate = (value: string | undefined): value is string => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
  let from = isDate(params.from) ? params.from : monthStartOf(today);
  let to = isDate(params.to) ? params.to : today;
  // A range the wrong way round (a hand-edited link) opens this month instead
  if (from > to) [from, to] = [monthStartOf(today), today];
  const query = parseSearchParams(attendanceListQuery, { ...params, from, to });
  const canManage = can(session.permissions, 'attendance.manage');
  const wide = viewScope === 'ALL' || viewScope === 'TEAM';

  const listParams = new URLSearchParams(
    Object.entries({ page: String(query.page), limit: '25', from, to, status: query.status, departmentId: query.departmentId, employeeId: query.employeeId }).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );

  const [myToday, list, summary, departments, employees] = await Promise.all([
    canSelf
      ? serverApiJson<DataResponse<MyAttendanceToday>>('/attendance/today')
          .then((r) => r.data)
          .catch((error: unknown) => {
            // No employee record: nothing to check in with
            if (error instanceof ApiRequestError && error.status === 404) return null;
            throw error;
          })
      : null,
    viewScope ? serverApiJson<ListResponse<AttendanceItem>>(`/attendance?${listParams.toString()}`) : null,
    viewScope
      ? serverApiJson<DataResponse<AttendanceSummary>>(`/attendance/summary?from=${from}&to=${to}${query.employeeId ? `&employeeId=${query.employeeId}` : ''}`).then((r) => r.data)
      : null,
    viewScope === 'ALL' ? serverApiJson<DataResponse<DepartmentListItem[]>>('/departments').then((r) => r.data) : [],
    canManage ? serverApiJson<ListResponse<EmployeeListItem>>('/employees?status=ACTIVE&limit=100&sort=name').then((r) => r.data) : [],
  ]);

  const present = summary ? summary.byStatus.PRESENT + summary.byStatus.LATE : 0;
  const expected = summary ? present + summary.byStatus.ABSENT : 0;

  if (list) redirectPastLastPage(list.meta, (page) => attendanceHref({ ...params, from, to }, { page: String(page) }));
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Attendance"
        description={wide ? `${formatDate(from)} – ${formatDate(to)}` : 'Your check-ins and attendance history'}
        actions={canManage && <CorrectionDialog employees={employees.map((e) => ({ id: e.id, name: e.fullName, employeeCode: e.employeeCode }))} />}
      />

      {myToday && <CheckInCard initial={myToday} />}

      {summary && (
        <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4" aria-label="Summary for the selected dates">
          <StatTile icon={CalendarCheck} label="Present" value={present} context={`${percent(present, expected)} of working days`} />
          <StatTile icon={Clock} label="Late" value={summary.byStatus.LATE} context={`${formatDuration(summary.totalLateMinutes)} in total`} />
          <StatTile icon={CalendarX2} label="Absent" value={summary.byStatus.ABSENT} context={`${summary.byStatus.ON_LEAVE} on leave`} />
          <StatTile icon={Timer} label="Average day" value={formatDuration(summary.averageWorkedMinutes)} context="From check-in to check-out" />
        </section>
      )}

      {list && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-panel" aria-label="Attendance records">
          <AttendanceFilters params={{ ...params, from, to }} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />

          {list.data.length === 0 ? (
            <StatePanel
              className="rounded-none border-0 shadow-none"
              icon={CalendarCheck}
              title="No attendance for these dates"
              description="Try a wider date range, or clear the status filter."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Date</TableHead>
                      {wide && <TableHead>Employee</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Worked</TableHead>
                      <TableHead className="hidden lg:table-cell">Note</TableHead>
                      {canManage && <TableHead className="w-16 pr-5 text-right">Fix</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="pl-5 whitespace-nowrap tabular">{formatDate(row.workDate)}</TableCell>
                        {wide && (
                          <TableCell>
                            <Link href={`/employees/${row.employee.id}?tab=attendance`} className="font-medium hover:underline">
                              {row.employee.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{row.employee.departmentName}</p>
                          </TableCell>
                        )}
                        <TableCell>
                          <AttendanceStatusBadge status={row.status} />
                          {row.status === 'LATE' && <span className="ml-1.5 text-xs text-muted-foreground tabular">{row.lateMinutes}m</span>}
                        </TableCell>
                        <TableCell className="tabular">{formatTime(row.firstInAt)}</TableCell>
                        <TableCell className="tabular">{formatTime(row.lastOutAt)}</TableCell>
                        <TableCell className="tabular">{formatDuration(row.workedMinutes)}</TableCell>
                        <TableCell className="hidden max-w-56 truncate text-sm text-muted-foreground lg:table-cell">
                          {row.corrected && <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-xs">Corrected</span>}
                          {row.note}
                        </TableCell>
                        {canManage && (
                          <TableCell className="pr-5 text-right">
                            <CorrectionDialog record={row} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y md:hidden">
                {list.data.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium tabular">{formatDate(row.workDate)}</p>
                        <AttendanceStatusBadge status={row.status} />
                      </div>
                      {wide && <p className="truncate text-sm">{row.employee.name}</p>}
                      <p className="text-sm text-muted-foreground tabular">
                        {formatTime(row.firstInAt)} – {formatTime(row.lastOutAt)} · {formatDuration(row.workedMinutes)}
                      </p>
                      {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
                    </div>
                    {canManage && <CorrectionDialog record={row} />}
                  </li>
                ))}
              </ul>

              <div className="border-t">
                <Pagination meta={list.meta} noun="records" hrefFor={(page) => attendanceHref({ ...params, from, to }, { page: String(page) })} />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
