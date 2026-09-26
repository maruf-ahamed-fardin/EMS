import { can, type DataResponse, type DocumentItem, documentListQuery, type DocumentTypeItem, type ListResponse } from '@/lib/validations';
import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DocumentList } from '@/components/documents/document-list';
import { UploadDocumentDialog } from '@/components/documents/upload-document-dialog';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { documentsHref } from '@/lib/client/documents';
import { redirectPastLastPage } from '@/lib/client/pagination';
import { parseSearchParams } from '@/lib/client/search-params';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/client/session';
import { cn } from '@/lib/client/utils';
import { DocumentFilters } from './document-filters';

export const metadata: Metadata = { title: 'Documents' };

const VIEWS = [
  { key: undefined, label: 'All' },
  { key: 'EXPIRING', label: 'Expiring within 30 days' },
  { key: 'EXPIRED', label: 'Expired' },
] as const;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'document.view')) return <Forbidden />;

  const raw = await searchParams;
  const query = parseSearchParams(documentListQuery, raw);
  // Only the parameters this page understands go back into links
  const params = { q: query.q, documentTypeId: query.documentTypeId, expiry: query.expiry, page: query.page > 1 ? String(query.page) : undefined };
  const search = new URLSearchParams(Object.entries({ ...params, page: String(query.page), limit: '20' }).filter((e): e is [string, string] => Boolean(e[1])));

  const [list, { data: types }] = await Promise.all([
    serverApiJson<ListResponse<DocumentItem>>(`/documents?${search.toString()}`),
    serverApiJson<DataResponse<DocumentTypeItem[]>>('/document-types'),
  ]);
  const ownOnly = session.permissions['document.view'] === 'OWN';
  const filtered = Boolean(query.q || query.documentTypeId);

  redirectPastLastPage(list.meta, (page) => documentsHref(params, { page: String(page) }));
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title={ownOnly ? 'My documents' : 'Documents'}
        description={ownOnly ? 'Your contracts, IDs and certificates. Links to download them work for one minute.' : 'Employee documents and what is about to expire.'}
        actions={
          session.employeeId &&
          can(session.permissions, 'document.upload') && (
            <UploadDocumentDialog employeeId={session.employeeId} employeeName={session.name} types={types} canUploadSensitive={can(session.permissions, 'employee.view_private')} own />
          )
        }
      />

      <nav aria-label="Views" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {VIEWS.map((v) => (
          <Link
            key={v.label}
            href={documentsHref(params, { expiry: v.key })}
            aria-current={v.key === query.expiry ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium hover:bg-secondary',
              v.key === query.expiry && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <section className="rounded-2xl border bg-card shadow-panel">
        <DocumentFilters params={params} types={types} />
        {list.data.length === 0 ? (
          <StatePanel
            icon={FileText}
            title={filtered ? 'No documents match' : query.expiry === 'EXPIRING' ? 'Nothing expires in the next 30 days' : query.expiry === 'EXPIRED' ? 'No expired documents' : 'No documents yet'}
            description={filtered ? 'Try another search or type.' : undefined}
            className="border-0 shadow-none"
          />
        ) : (
          <>
            <div className="p-4 md:p-5">
              <DocumentList documents={list.data} showEmployee={!ownOnly} />
            </div>
            <div className="border-t">
              <Pagination meta={list.meta} noun="documents" hrefFor={(page) => documentsHref(params, { page: String(page) })} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
