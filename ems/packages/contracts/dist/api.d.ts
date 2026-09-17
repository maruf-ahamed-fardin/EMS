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
export declare const MAX_PAGE_LIMIT = 100;
export declare const paginationQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type PaginationQuery = z.infer<typeof paginationQuery>;
export declare function pageMeta(page: number, limit: number, total: number): PageMeta;
export interface HealthResponse {
    status: 'ok';
}
export interface ReadinessResponse {
    status: 'ok' | 'unavailable';
    checks: Record<string, 'ok' | 'failed'>;
}
//# sourceMappingURL=api.d.ts.map