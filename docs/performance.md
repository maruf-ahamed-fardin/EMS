# Performance

## Query review (Phase 12, 2026-09-19)

**Method.** A throwaway database (`ems_perf`) with the demo seed plus bulk rows: 2 060 employees (1 in 10 managing
the next 9), 491 546 attendance rows (about a year), 10 047 leave requests, 200 000 audit entries and 100 000
notifications. A second API instance ran against it with PostgreSQL's `auto_explain` logging the actual plan of
every statement over 30 ms, and 36 requests covered every list, dashboard, report, search and filter, as HR and as
a manager. The database was dropped afterwards.

**Result.** Every request answered in under 145 ms on a laptop; 28 of 36 in under 35 ms. Only 8 statements passed
30 ms:

| Statement | Time | Plan | Verdict |
|---|---|---|---|
| Attendance count with no date filter | 123 ms | Sequential scan of all attendance | The app always sends a date range (the attendance page defaults to this month), so this is an API-only case. Acceptable; revisit if the table passes a few million rows. |
| Attendance page 1 500 of a 100-day range | 75 ms | `attendances_work_date_status_idx`, hash joins, sort of the range | Deep offsets cost a sort of the filtered range. Exports use the same query in batches of 2 000: 25 of them for 50 000 rows. |
| Audit log page 4 000 | 55 ms | `audit_logs_created_at_idx` in order, incremental sort | Fine; nobody pages that deep, filters narrow it first. |
| Attendance summaries and counts for a range | 30–47 ms | Bitmap scan on `attendances_work_date_status_idx` | Fine. |

**No index changes were needed.** The schema's indexes (plan §3) cover the filters in use: attendance by
`(employee_id, work_date)` and `(work_date, status)`, audit by `created_at`, `(entity_type, entity_id)`, `action`
and `actor_user_id`, notifications by `(user_id, read_at, created_at)`, documents by `expires_at` for live rows.

## Exports

A 50 000-row export streams in every format with at most 5 MB of live memory (tested in
`reports.e2e-spec.ts`, which fails above 10 MB).

## Known costs

- Lists use page numbers, so very deep pages sort everything before them. Page sizes are capped at 100.
- The dashboard is cached for 30 seconds per scope and cleared by any audited change.
- Rate limits and the permission cache live in memory: one API instance, or the Redis throttler store with more.
