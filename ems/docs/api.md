# API

Base path **`/api/v1`**, JSON only (file uploads and exports are the exceptions, from Phases 8 and 10).
The full endpoint list by module is in [plan.md §6](plan.md); this page is the contract every endpoint
follows, and it lists what exists today.

## Responses

```jsonc
// one resource
{ "data": { ... } }

// a list
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 } }

// any error
{ "statusCode": 422, "message": "Validation failed", "errors": { "email": "Invalid email address" }, "requestId": "0192…" }
```

Types for all three are in `@ems/contracts` (`DataResponse`, `ListResponse`, `ApiError`).

| Status | When | `message` |
|---|---|---|
| 401 | No valid session | "You need to sign in" |
| 403 | Signed in, permission missing | "You don't have access to this" |
| 404 | Not found, **or out of the caller's scope** (existence isn't revealed) | "Not found" |
| 409 | A unique value is taken, or a rule blocks the change | Specific, e.g. "Department still has 3 active employees" |
| 422 | Input failed validation | "Validation failed", with `errors` per field |
| 429 | Rate limited | "Too many requests. Try again shortly." |
| 500 | Anything unexpected | "Something went wrong" (details only in the log, found by `requestId`) |

## Headers

- `x-request-id` on every response. A caller's own id is reused when it looks like one (8–128 of
  `A-Za-z0-9._:-`), so a trace can pass through the Next.js proxy.
- `cache-control: private, no-store` by default.
- Security headers from helmet; no `x-powered-by`.

## Lists

`?page=` (from 1) and `?limit=` (1–100, default 20), `?sort=field:asc|desc` with an allow-list per
endpoint, `?q=` for search, plus module filters. The shared `paginationQuery` schema is in contracts.

## Endpoints available now

| Method and path | Auth | Returns |
|---|---|---|
| `GET /api/v1/health` | public | `{ "status": "ok" }`. Liveness; never touches the database. |
| `GET /api/v1/health/ready` | public | `{ "status": "ok", "checks": { "database": "ok" } }`, or 503 with `"unavailable"` |
