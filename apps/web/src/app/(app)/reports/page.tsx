import {
  can,
  type DataResponse,
  type DepartmentListItem,
  type LeaveTypeItem,
  MAX_EXPORT_ROWS,
  REPORT_KEYS,
  REPORT_TITLES,
  type ReportResponse,
} from '@ems/contracts';
import { ChartColumn, Download, FileWarning, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api-error';
import { dhakaToday } from '@/lib/attendance';
import { defaultRange, exportHref, FORMAT_LABELS, REPORT_DESCRIPTIONS, reportKey, reportParams, reportsHref } from '@/lib/reports';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { ReportFilters } from './report-filters';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'report.view')) return <Forbidden />;

  const raw = await searchParams;
  const key = reportKey(raw.report);
  const filters = reportParams(key, { ...defaultRange(key, dhakaToday()), ...raw });
  const page = Math.max(1, Number(raw.page) || 1);
  const query = new URLSearchParams({ ...filters, page: String(page), limit: '25' }).toString();

  const [departments, leaveTypes] = await Promise.all([
    serverApiJson<DataResponse<DepartmentListItem[]>>('/departments'),
    key === 'leave' ? serverApiJson<DataResponse<LeaveTypeItem[]>>('/leave/types') : null,
  ]);
  let report: ReportResponse | null = null;
  let problem: string | null = null;
  try {
    report = await serverApiJson<ReportResponse>(`/reports/${key}?${query}`);
  } catch (error) {
    // Invalid filters (a range over a year, the end before the start) are shown, not thrown
    if (!(error instanceof ApiRequestError) || error.status !== 422) throw error;
    problem = Object.values(error.errors)[0] ?? error.message;
  }
  const canExport = can(session.permissions, 'report.export');
  const tooMany = report !== null && report.meta.total > MAX_EXPORT_ROWS;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Reports" description={REPORT_DESCRIPTIONS[key]} />

      <nav aria-label="Reports" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {REPORT_KEYS.map((k) => (
          <Link
            key={k}
            href={reportsHref(k, {})}
            aria-current={k === key ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium hover:bg-secondary',
              k === key && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {REPORT_TITLES[k]}
          </Link>
        ))}
      </nav>

      <section className="rounded-2xl border bg-card shadow-panel" aria-label="Filters and export">
        <ReportFilters
          report={key}
          values={filters}
          departments={departments.data.map((d) => ({ value: d.id, label: d.name }))}
          leaveTypes={(leaveTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
        />
        {canExport && report && (
          <div className="flex flex-wrap items-center gap-2 p-4">
            <span className="mr-1 text-sm text-muted-foreground">Download all {report.meta.total.toLocaleString('en-US')} rows:</span>
            {(['csv', 'xlsx', 'pdf'] as const).map((format) =>
              tooMany ? (
                <Button key={format} variant="outline" className="h-9" disabled>
                  <Download aria-hidden /> {FORMAT_LABELS[format]}
                </Button>
              ) : (
                <Button key={format} asChild variant="outline" className="h-9">
                  <a href={exportHref(key, filters, format)} download>
                    <Download aria-hidden /> {FORMAT_LABELS[format]}
                  </a>
                </Button>
              ),
            )}
            {tooMany && (
              <p className="flex w-full items-center gap-2 text-sm text-warning-text">
                <FileWarning className="size-4" aria-hidden /> Downloads stop at {MAX_EXPORT_ROWS.toLocaleString('en-US')} rows. Narrow the dates or add a filter.
              </p>
            )}
          </div>
        )}
      </section>

      {problem ? (
        <StatePanel icon={SearchX} tone="warning" title="Check the filters" description={problem} />
      ) : report && report.meta.total === 0 ? (
        <StatePanel icon={ChartColumn} title="Nothing matches these filters" description="Try other dates or remove a filter." />
      ) : (
        report && (
          <>
            <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.summary.figures.map((f) => (
                <div key={f.label} className="rounded-2xl border bg-card p-4 shadow-panel">
                  <p className="text-sm text-muted-foreground">{f.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight tabular">{typeof f.value === 'number' ? f.value.toLocaleString('en-US') : f.value}</p>
                </div>
              ))}
            </section>

            {report.summary.sections.some((s) => s.rows.length > 0) && (
              <section aria-label="Breakdown" className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {report.summary.sections
                  .filter((s) => s.rows.length > 0)
                  .map((s) => (
                    <div key={s.title} className="rounded-2xl border bg-card p-4 shadow-panel">
                      <h2 className="mb-2 text-sm font-semibold">{s.title}</h2>
                      <dl className="grid grid-cols-1 gap-1 text-sm">
                        {s.rows.map((r) => (
                          <div key={r.label} className="flex justify-between gap-3">
                            <dt className="truncate text-muted-foreground">{r.label}</dt>
                            <dd className="font-medium tabular">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border bg-card shadow-panel" aria-label={`${report.title} report`}>
              {report.filters.length > 0 && <p className="border-b px-4 py-3 text-sm text-muted-foreground">{report.filters.join(' · ')}</p>}
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {report.columns.map((c) => (
                      <TableHead key={c.key} className={cn('whitespace-nowrap first:pl-4 last:pr-4', c.numeric && 'text-right')}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.map((row, i) => (
                    <TableRow key={i}>
                      {report.columns.map((c) => (
                        <TableCell key={c.key} className={cn('whitespace-nowrap first:pl-4 last:pr-4', c.numeric && 'text-right tabular')}>
                          {row[c.key] ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t">
                <Pagination meta={report.meta} noun="rows" hrefFor={(p) => reportsHref(key, filters, p)} />
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}
