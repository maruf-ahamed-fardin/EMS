import { DOCUMENT_MIME_TYPES, type DocumentExpiry, MAX_DOCUMENT_BYTES } from '@ems/contracts';

/** For the file picker. The server still checks the bytes; this only narrows what the picker offers. */
export const DOCUMENT_ACCEPT = [...Object.keys(DOCUMENT_MIME_TYPES), ...Object.values(DOCUMENT_MIME_TYPES).map((t) => `.${t.extension}`), '.jpeg'].join(',');

export const EXPIRY_LABELS: Record<DocumentExpiry, string> = {
  VALID: 'Valid',
  EXPIRING: 'Expiring soon',
  EXPIRED: 'Expired',
};

/** "840 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "PDF", "Word document" for a stored MIME type. */
export function fileKind(mimeType: string): string {
  return DOCUMENT_MIME_TYPES[mimeType as keyof typeof DOCUMENT_MIME_TYPES]?.label ?? 'File';
}

/**
 * A quick check before uploading, so a 40 MB photo fails at once instead of after the upload. Only
 * size and extension: the server decides the real type from the file's bytes.
 */
export function checkDocumentFile(file: File): string | null {
  if (file.size === 0) return 'This file is empty';
  if (file.size > MAX_DOCUMENT_BYTES) return `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_DOCUMENT_BYTES)}.`;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['pdf', 'png', 'jpg', 'jpeg', 'docx'].includes(extension)) return 'Upload a PDF, PNG, JPEG or Word (.docx) file';
  return null;
}

/** A title from the file name: "passport-scan_2026.pdf" → "passport scan 2026". */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

/** The /documents URL with some parameters changed. A new filter goes back to page 1. */
export function documentsHref(current: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  if (!('page' in changes)) delete merged.page;
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/documents?${query}` : '/documents';
}

/** Opens a 60-second link for the file. It is sent as an attachment, so the browser stays on this page. */
export function downloadDocument(url: string): void {
  window.location.assign(url);
}
