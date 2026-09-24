import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './api';
import { isoDate } from './employees';

/** Plan §7: 10 MB per file. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** What an upload may be, decided from the file's bytes, never its name or declared type. */
export const DOCUMENT_MIME_TYPES = {
  'application/pdf': { label: 'PDF', extension: 'pdf' },
  'image/png': { label: 'PNG image', extension: 'png' },
  'image/jpeg': { label: 'JPEG image', extension: 'jpg' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'Word document', extension: 'docx' },
} as const;
export type DocumentMimeType = keyof typeof DOCUMENT_MIME_TYPES;

/** Documents that expire within this many days show as "expiring" and appear in "Needs your attention". */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

/** How long a download link works. Links are never stored. */
export const DOCUMENT_URL_TTL_SECONDS = 60;

// ─── Document types ─────────────────────────────────────────────────────────────────────────────

const documentTypeFields = {
  name: z.string().trim().min(1, 'Name the document type').max(100, 'Keep the name under 100 characters'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Use 2–30 letters, digits or underscores, e.g. NATIONAL_ID'),
  isSensitive: z.boolean().default(false),
  hasExpiry: z.boolean().default(false),
};

export const createDocumentTypeInput = z.object(documentTypeFields);
export type CreateDocumentTypeInput = z.input<typeof createDocumentTypeInput>;

export const updateDocumentTypeInput = z
  .object({ name: documentTypeFields.name, code: documentTypeFields.code, isSensitive: z.boolean(), hasExpiry: z.boolean() })
  .partial()
  .strict();
export type UpdateDocumentTypeInput = z.input<typeof updateDocumentTypeInput>;

export interface DocumentTypeItem {
  id: string;
  name: string;
  code: string;
  /** Only people who may see the employee's private details can open these (plan §4). */
  isSensitive: boolean;
  /** Documents of this type need an expiry date. */
  hasExpiry: boolean;
  /** Documents of this type across the organization; only for people who manage types, otherwise null. */
  documentCount: number | null;
}

// ─── Documents ──────────────────────────────────────────────────────────────────────────────────

/** The text fields sent with the file in a multipart upload. */
export const uploadDocumentFields = z.object({
  documentTypeId: z.uuid('Choose a document type'),
  title: z.string().trim().min(1, 'Give the document a title').max(150, 'Keep the title under 150 characters'),
  expiresAt: z
    .union([isoDate, z.literal('')])
    .optional()
    .transform((value) => value || undefined),
});
export type UploadDocumentFields = z.input<typeof uploadDocumentFields>;

export type DocumentExpiry = 'VALID' | 'EXPIRING' | 'EXPIRED';

export interface DocumentItem {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  documentType: { id: string; name: string; isSensitive: boolean; hasExpiry: boolean };
  title: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  expiresAt: string | null;
  /** Null when the document doesn't expire. */
  expiry: DocumentExpiry | null;
  uploadedBy: string | null;
  uploadedAt: string;
  allowedActions: { delete: boolean };
}

export interface DocumentUrl {
  url: string;
  expiresAt: string;
}

export const documentListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  employeeId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  documentTypeId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  expiry: z.enum(['EXPIRING', 'EXPIRED']).optional().catch(undefined),
});
export type DocumentListQuery = z.infer<typeof documentListQuery>;
