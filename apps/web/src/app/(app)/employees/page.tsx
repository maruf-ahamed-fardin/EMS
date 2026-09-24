import {
  can,
  type DataResponse,
  type EmployeeFormOptions,
  type EmployeeListItem,
  employeeListQuery,
  type ListResponse,
} from '@ems/contracts';
import { Plus, SearchX, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatePanel } from '@/components/shared/state-panel';
import { StatusBadge, Tag } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dhakaDateDaysAgo, EMPLOYMENT_TYPE_LABELS, employeesHref, formatDate } from '@/lib/employees';
import { redirectPastLastPage } from '@/lib/pagination';
import { parseSearchParams } from '@/lib/search-params';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { EmployeeFilters } from './employee-filters';

export const metadata: Metadata = { title: 'Employees' };

type SearchParams = Record<string, string | string[] | undefined>;

function flatten(params: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'employee.view', 'TEAM')) return <Forbidden />;

  const raw = flatten(await searchParams);
  const query = parseSearchParams(employeeListQuery, raw);
  // Only the parameters that passed go to the API and back into links
  const params = Object.fromEntries(Object.entries(raw).filter(([key]) => (query as Record<string, unknown>)[key] !== undefined));
  const apiQuery = new URLSearchParams(
    Object.entries({ ...params, page: String(query.page), limit: String(query.limit), sort: query.sort }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );

  const canCreate = can(session.permissions, 'employee.create');
  const canUseOptions = canCreate || can(session.permissions, 'employee.update');
  const [list, options] = await Promise.all([
    serverApiJson<ListResponse<EmployeeListItem>>(`/employees?${apiQuery.toString()}`),
    canUseOptions ? serverApiJson<DataResponse<EmployeeFormOptions>>('/employees/form-options').then((r) => r.data) : null,
  ]);

  const newHiresFrom = dhakaDateDaysAgo(30);
  const views = [
    { label: 'Everyone', changes: { status: undefined, joinedFrom: undefined } },
    { label: 'Active', changes: { status: 'ACTIVE', joinedFrom: undefined } },
    { label: 'New hires', changes: { status: undefined, joinedFrom: newHiresFrom } },
    { label: 'Inactive', changes: { status: 'INACTIVE', joinedFrom: undefined } },
  ];
  const activeView = views.find((view) => (view.changes.status ?? undefined) === params.status && (view.changes.joinedFrom ?? undefined) === params.joinedFrom);
  const filtered = Boolean(query.q || query.departmentId || query.employmentType || query.status || query.joinedFrom);

  redirectPastLastPage(list.meta, (page) => employeesHref(params, { page: String(page) }));
  return (
    <>
      <PageHeader
        title="Employees"
        description={`${list.meta.total} ${list.meta.total === 1 ? 'person' : 'people'}${filtered ? ' match these filters' : ''}`}
        actions={
          canCreate && (
            <Button asChild className="h-10">
              <Link href="/employees/new">
                <Plus aria-hidden /> Add employee
              </Link>
            </Button>
          )
        }
      />

      <nav aria-label="Quick views" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {views.map((view) => (
          <Link
            key={view.label}
            href={employeesHref(params, view.changes)}
            aria-current={view === activeView ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-secondary',
              view === activeView && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {view.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-panel">
        <EmployeeFilters params={params} departments={options?.departments ?? []} />

        {list.data.length === 0 ? (
          filtered ? (
            <StatePanel
              className="rounded-none border-0 shadow-none"
              icon={SearchX}
              title="No one matches these filters"
              description="Try a different name or ID, or clear the filters."
              action={
                <Button asChild variant="outline">
                  <Link href="/employees">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <StatePanel
              className="rounded-none border-0 shadow-none"
              icon={Users}
              title="No employees yet"
              description={canCreate ? 'Add your first employee to get started.' : 'Employees you can see will appear here.'}
              action={
                canCreate && (
                  <Button asChild>
                    <Link href="/employees/new">Add employee</Link>
                  </Button>
                )
              }
            />
          )
        ) : (
          <>
            {/* Desktop and tablet: a table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Employee</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="hidden lg:table-cell">Position</TableHead>
                    <TableHead className="hidden xl:table-cell">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((person) => (
                    <TableRow key={person.id} className="relative">
                      <TableCell className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={person.fullName} size="sm" />
                          <div className="min-w-0">
                            {/* The link covers the whole row, so any cell opens the profile */}
                            <Link href={`/employees/${person.id}`} className="font-semibold outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                              {person.fullName}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{person.employeeCode}</TableCell>
                      <TableCell>
                        <Tag>{person.department.name}</Tag>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{person.position.title}</TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">{EMPLOYMENT_TYPE_LABELS[person.employmentType]}</TableCell>
                      <TableCell>
                        <StatusBadge status={person.status} />
                      </TableCell>
                      <TableCell className="pr-5 text-muted-foreground tabular">{formatDate(person.joiningDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phones: cards */}
            <ul className="divide-y md:hidden">
              {list.data.map((person) => (
                <li key={person.id}>
                  <Link href={`/employees/${person.id}`} className="flex gap-3 px-4 py-4 outline-none hover:bg-secondary focus-visible:bg-secondary">
                    <PersonAvatar name={person.fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold">{person.fullName}</p>
                        <StatusBadge status={person.status} />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {person.position.title} · <span className="font-mono text-xs">{person.employeeCode}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Tag>{person.department.name}</Tag>
                        <span>Joined {formatDate(person.joiningDate)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t">
              <Pagination meta={list.meta} noun="people" hrefFor={(page) => employeesHref(params, { page: String(page) })} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
