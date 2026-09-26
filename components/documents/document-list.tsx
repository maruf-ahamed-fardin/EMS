import type { DocumentItem } from '@/lib/validations';
import { FileImage, FileText, Lock } from 'lucide-react';
import Link from 'next/link';
import { Tag } from '@/components/shared/status-badge';
import { dhakaToday } from '@/lib/client/attendance';
import { formatDate } from '@/lib/client/employees';
import { fileKind, formatBytes } from '@/lib/client/documents';
import { DocumentActions } from './document-actions';
import { DocumentExpiryBadge } from './document-expiry-badge';

/** One row per document; the same layout works on a phone and a desktop. */
export function DocumentList({ documents, showEmployee = false }: { documents: DocumentItem[]; showEmployee?: boolean }) {
  return (
    <ul className="divide-y">
      {documents.map((d) => {
        const Icon = d.mimeType.startsWith('image/') ? FileImage : FileText;
        return (
          <li key={d.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Tag>
                  {d.documentType.isSensitive && <Lock className="mr-1 size-3" aria-label="Sensitive" />}
                  {d.documentType.name}
                </Tag>
                <DocumentExpiryBadge expiry={d.expiry} expiresAt={d.expiresAt} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {showEmployee && (
                  <>
                    <Link href={`/employees/${d.employee.id}?tab=documents`} className="font-medium text-foreground hover:underline">
                      {d.employee.name}
                    </Link>{' '}
                    · <span className="font-mono">{d.employee.employeeCode}</span> ·{' '}
                  </>
                )}
                {fileKind(d.mimeType)} · {formatBytes(d.sizeBytes)} · added {formatDate(dhakaToday(new Date(d.uploadedAt)))}
                {d.uploadedBy ? ` by ${d.uploadedBy}` : ''}
              </p>
            </div>
            <DocumentActions document={d} />
          </li>
        );
      })}
    </ul>
  );
}
