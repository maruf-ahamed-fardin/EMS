import { z } from 'zod';

/** `{ data }` for a single resource. */
export interface DataResponse<T> {
  data: T;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** `{ data, meta }` for a paginated list. */
export interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

/**
 * Every error response (spec §35). `errors` maps a field path to one message and is present
 * only for validation and uniqueness failures.
 */
export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string>;
  requestId: string;
}

export const MAX_PAGE_LIMIT = 100;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export interface HealthResponse {
  status: 'ok';
}

export interface ReadinessResponse {
  status: 'ok' | 'unavailable';
  checks: Record<string, 'ok' | 'failed'>;
}
