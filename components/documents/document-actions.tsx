'use client';

import type { DataResponse, DocumentItem, DocumentUrl } from '@/lib/validations';
import { Download, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteButton } from '@/components/shared/delete-button';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api-client';
import { ApiRequestError } from '@/lib/client/api-error';
import { downloadDocument } from '@/lib/client/documents';

/**
 * Download, and delete when allowed. A download link is asked for at the moment of the click, never
 * rendered into the page, because it only works for 60 seconds and every request is audited.
 */
export function DocumentActions({ document }: { document: Pick<DocumentItem, 'id' | 'title' | 'allowedActions'> }) {
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const { data } = await api<DataResponse<DocumentUrl>>(`/documents/${document.id}/url`);
      downloadDocument(data.url);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not download the file. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon" className="size-9" onClick={() => void download()} disabled={pending} aria-label={`Download ${document.title}`}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      </Button>
      {document.allowedActions.delete && (
        <DeleteButton
          size="icon"
          label={`Delete ${document.title}`}
          path={`/documents/${document.id}`}
          title={`Delete ${document.title}?`}
          description="It disappears from the profile and can no longer be downloaded. The record of it stays in the audit log."
          successMessage={`${document.title} deleted`}
        />
      )}
    </div>
  );
}
