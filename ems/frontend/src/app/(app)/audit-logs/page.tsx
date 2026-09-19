import { type AuditListItem, auditListQuery, can, type ListResponse } from '@ems/contracts';
import { ChevronRight, ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { actionLabel, auditHref, entityTypeLabel, fieldLabel } from '@/lib/audit';
import { formatDateTime } from '@/lib/employees';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { AuditFilters } from './audit-filters';
import { parseSearchParams } from '@/lib/search-params';
import { redirectPastLastPage } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'audit.view', 'ALL')) return <Forbidden />;

  const query = parseSearchParams(auditListQuery, await searchParams);
  // Only the parameters this page understands go back into links
  const params = {
    action: query.action,
    entityType: query.entityType,
    entityId: query.entityId,
    actorUserId: query.actorUserId,
    from: query.from,
    to: query.to,
    page: query.page > 1 ? String(query.page) : undefined,
  };
  const search = new URLSearchParams(Object.entries({ ...params, page: String(query.page), limit: '25' }).filter((e): e is [string, string] => Boolean(e[1])));
  const list = await serverApiJson<ListResponse<AuditListItem>>(`/audit-logs?${search.toString()}`);
  const actorName = query.actorUserId ? (list.data.find((l) => l.actor?.id === query.actorUserId)?.actor?.name ?? null) : null;
  const entityLabel = query.entityId ? (list.data.find((l) => l.entityId === query.entityId)?.entityLabel ?? null) : null;

  redirectPastLastPage(list.meta, (page) => auditHref(params, { page: String(page) }));
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Audit log" description="Every change, who made it and when. Entries can't be edited or deleted." />
      <section className="overflow-hidden rounded-2xl border bg-card shadow-panel">
        <AuditFilters params={params} actorName={actorName} entityLabel={entityLabel} />
        {list.data.length === 0 ? (
          <StatePanel icon={ScrollText} title="No entries match" description="Try other dates or remove a filter." className="border-0 shadow-none" />
        ) : (
          <>
            <ul className="divide-y">
              {list.data.map((entry) => (
                <li key={entry.id} className="relative flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {entry.actor ? (
                        <Link href={auditHref(params, { actorUserId: entry.actor.id })} className="relative z-10 font-semibold hover:underline">
                          {entry.actor.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-muted-foreground">System</span>
                      )}{' '}
                      <Link href={`/audit-logs/${entry.id}`} className="after:absolute after:inset-0">
                        {actionLabel(entry.action).toLowerCase()}
                      </Link>
                      {entry.entityLabel && (
                        <>
                          {': '}
                          <Link href={auditHref(params, { entityType: entry.entityType, entityId: entry.entityId ?? undefined })} className="relative z-10 font-medium hover:underline">
                            {entry.entityLabel}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time> · {entityTypeLabel(entry.entityType)}
                      {entry.changedFields.length > 0 && ` · ${entry.changedFields.map(fieldLabel).join(', ')}`}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                </li>
              ))}
            </ul>
            <div className="border-t">
              <Pagination meta={list.meta} noun="entries" hrefFor={(page) => auditHref(params, { page: String(page) })} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
