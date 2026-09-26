import { type AuditDetail, can, type DataResponse } from '@/lib/validations';
import { ChevronRight, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Forbidden } from '@/components/shared/module-page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/client/api-error';
import { actionLabel, auditHref, entityHref, entityTypeLabel, fieldLabel, formatValue } from '@/lib/client/audit';
import { formatDateTime } from '@/lib/client/employees';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/client/session';

export const metadata: Metadata = { title: 'Audit entry' };

export default async function AuditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'audit.view', 'ALL')) return <Forbidden />;

  const { id } = await params;
  let entry: AuditDetail;
  try {
    entry = (await serverApiJson<DataResponse<AuditDetail>>(`/audit-logs/${encodeURIComponent(id)}`)).data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  const recordHref = entityHref(entry.entityType, entry.entityId);

  return (
    <div className="grid grid-cols-1 gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/audit-logs" className="hover:text-foreground hover:underline">
          Audit log
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">
          {actionLabel(entry.action)}
        </span>
      </nav>

      <section className="rounded-2xl border bg-card p-5 shadow-panel md:p-6">
        <h1 className="text-2xl font-bold tracking-tight">{actionLabel(entry.action)}</h1>
        <p className="mt-1 text-muted-foreground">
          {entry.actor ? entry.actor.name : 'The system'} · <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-muted-foreground">Record</dt>
          <dd className="font-medium">
            {entityTypeLabel(entry.entityType)}
            {entry.entityLabel && (
              <>
                {': '}
                {recordHref ? (
                  <Link href={recordHref} className="text-primary hover:underline">
                    {entry.entityLabel}
                  </Link>
                ) : (
                  entry.entityLabel
                )}
              </>
            )}
          </dd>
          {entry.actor && (
            <>
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="font-medium break-all">{entry.actor.email}</dd>
            </>
          )}
          <dt className="text-muted-foreground">IP address</dt>
          <dd className="font-mono text-xs">{entry.ip ?? '—'}</dd>
          <dt className="text-muted-foreground">Browser</dt>
          <dd className="text-xs break-words text-muted-foreground">{entry.userAgent ?? '—'}</dd>
          <dt className="text-muted-foreground">Request ID</dt>
          <dd className="font-mono text-xs break-all">{entry.requestId}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {entry.entityId && (
            <Link href={auditHref({}, { entityType: entry.entityType, entityId: entry.entityId })} className="font-medium text-primary hover:underline">
              Everything about this record
            </Link>
          )}
          {entry.actor && (
            <Link href={auditHref({}, { actorUserId: entry.actor.id })} className="font-medium text-primary hover:underline">
              Everything by {entry.actor.name}
            </Link>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-panel" aria-labelledby="changes-title">
        <h2 id="changes-title" className="border-b px-5 py-4 font-semibold">
          {entry.changes.length > 0 ? 'What changed' : 'No field values were recorded'}
        </h2>
        {entry.changes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44 pl-5">Field</TableHead>
                <TableHead>Before</TableHead>
                <TableHead className="pr-5">After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.changes.map((change) => (
                <TableRow key={change.field} className="align-top">
                  <TableCell className="pl-5 font-medium capitalize">{fieldLabel(change.field)}</TableCell>
                  {change.hidden ? (
                    <TableCell colSpan={2} className="pr-5 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Lock className="size-3.5" aria-hidden /> Private. Your role can&rsquo;t see employees&rsquo; private details.
                      </span>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="whitespace-pre-line text-muted-foreground">{formatValue(change.before)}</TableCell>
                      <TableCell className="pr-5 whitespace-pre-line">{formatValue(change.after)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
