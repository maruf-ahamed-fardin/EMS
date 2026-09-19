import { can, type DataResponse, type DocumentTypeItem } from '@ems/contracts';
import { Lock, Tags } from 'lucide-react';
import type { Metadata } from 'next';
import { DeleteButton } from '@/components/shared/delete-button';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { StatePanel } from '@/components/shared/state-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { DocumentTypeDialog } from './document-type-dialog';

export const metadata: Metadata = { title: 'Document types' };

export default async function DocumentTypesPage() {
  const session = await getSession();
  if (!session || !can(session.permissions, 'document.manage_types')) return <Forbidden />;
  const { data: types } = await serverApiJson<DataResponse<DocumentTypeItem[]>>('/document-types');

  return (
    <div className="grid gap-6">
      <PageHeader title="Document types" description="What can be uploaded to a profile, which types are private, and which expire." actions={<DocumentTypeDialog />} />
      {types.length === 0 ? (
        <StatePanel icon={Tags} title="No document types yet" description="Add National ID, Passport and Employment contract to get started." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-panel">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Type</TableHead>
                <TableHead>Private</TableHead>
                <TableHead className="hidden sm:table-cell">Expires</TableHead>
                <TableHead className="hidden sm:table-cell">Documents</TableHead>
                <TableHead className="w-24 pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">{type.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{type.code}</p>
                  </TableCell>
                  <TableCell>
                    {type.isSensitive ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Lock className="size-3.5" aria-hidden /> Private
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{type.hasExpiry ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="hidden tabular sm:table-cell">{type.documentCount}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <DocumentTypeDialog type={type} />
                      <DeleteButton
                        size="icon"
                        label={`Delete ${type.name}`}
                        path={`/document-types/${type.id}`}
                        title={`Delete ${type.name}?`}
                        description="Nobody can upload it any more."
                        successMessage={`${type.name} deleted`}
                        blockedReason={type.documentCount > 0 ? `${type.documentCount} documents use it.` : undefined}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
