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
| 403 | A write failed the CSRF checks | "Your session needs refreshing. Reload the page and try again." |
| 404 | Not found, **or out of the caller's scope** (existence isn't revealed) | "Not found" |
| 409 | A unique value is taken, or a rule blocks the change | Specific, e.g. "Department still has 3 active employees" |
| 422 | Input failed validation or a business rule on a field | "Validation failed", with `errors` per field |
| 429 | Rate limited | "Too many requests. Try again shortly." |
| 500 | Anything unexpected | "Something went wrong" (details only in the log, found by `requestId`) |

## Authentication and CSRF

- **Session:** `POST /auth/login` sets `ems_session` (httpOnly, SameSite=Lax, Secure over https,
  7 days at most, ends after 8 idle hours). The API stores only its sha256.
- **Every route needs a session** unless the handler is marked `@Public()`.
- **Writes** (anything but GET/HEAD/OPTIONS) must pass three checks, in addition to the SameSite cookie:
  1. `Sec-Fetch-Site`, when the browser sends it, is `same-origin` (or `none`);
  2. `Origin`, when present, is `APP_URL` (or a `CORS_ORIGINS` entry);
  3. the `x-csrf-token` header equals the `ems_csrf` cookie. `GET /auth/csrf` issues the cookie;
     login rotates it.

  The web app's `api()` helper (`frontend/src/lib/api-client.ts`) does all of this.
- **Rate limits:** 300 requests a minute per session (or IP before sign-in). Login: 5 a minute per IP and
  email. Forgot password: 3 an hour per IP and email. Reset and change password: 10 an hour.
- **Lockout:** 10 wrong passwords in a row lock the account for 15 minutes. Every failed sign-in, including
  a locked or inactive account, answers "Email or password is incorrect".

## Lists

`?page=` (from 1) and `?limit=` (1–100, default 20), `?sort=field:asc|desc` with an allow-list per
endpoint, `?q=` for search, plus module filters. The shared `paginationQuery` schema is in contracts.

## Endpoints available now

| Method and path | Access | Result |
|---|---|---|
| `GET /health` | public | `{ "status": "ok" }`. Liveness; never touches the database. |
| `GET /health/ready` | public | `{ "status": "ok", "checks": { "database": "ok" } }`, or 503 `"unavailable"` |
| `GET /auth/csrf` | public | `{ data: { csrfToken } }` and the `ems_csrf` cookie |
| `POST /auth/login` | public | `{ email, password }` → `{ data: MeResponse }` and the session cookie. 401 on any failure. |
| `POST /auth/logout` | session | 204. Revokes the session and clears both cookies. |
| `POST /auth/logout-others` | session | `{ data: { sessionsRevoked } }`. Every other session of this user ends. |
| `GET /auth/me` | session | `{ data: MeResponse }`: user, role and `permissions: { key: scope }` |
| `POST /auth/forgot-password` | public | `{ email }` → always 202 with the same message. Emails a 30-minute, single-use link when the account exists. |
| `POST /auth/reset-password` | public | `{ token, password }` → 204. Signs the user out everywhere. 422 when the link is invalid, used or expired, or the password is weak. |
| `POST /auth/change-password` | session | `{ currentPassword, newPassword }` → 204. Signs out other sessions, keeps this one. |
| `GET /roles` | `role.manage` | Roles with user counts and their grants |
| `GET /permissions` | `role.manage` | The permission catalogue |
| `GET /employees` | `employee.view` (scoped) | List. Query: `page`, `limit`, `q`, `departmentId`, `positionId`, `managerId`, `status`, `employmentType`, `joinedFrom`, `sort` (`name`, `code`, `joined`, `created`; prefix `-` for descending) |
| `GET /employees/form-options` | `employee.create` or `employee.update` | Departments, positions, active managers, assignable roles, next free employee ID |
| `GET /employees/check-unique` | `employee.create` or `employee.update` | `?email=&employeeCode=&excludeId=` → availability, with the ID of whoever holds the email |
| `POST /employees` | `employee.create` | 201 with the detail. Checks the department, the position (must belong to the department) and the manager. Optional account: `createAccount`, `roleKey` (only `employee` without `user.manage`); emails a 3-day set-password link. Creates this year's leave balances. 409 with `errors.email` or `errors.employeeCode` on duplicates. |
| `GET /employees/:id` | `employee.view` (scoped) | Detail. `private` only with `employee.view_private` for that person; `account` only with `user.view`; `allowedActions` for the viewer. 404 outside scope. |
| `PATCH /employees/:id` | `employee.update` (scoped) | Any record field except status. Only real changes are saved and audited. Refuses reporting loops. Changing the email also changes the sign-in email. |
| `POST /employees/:id/deactivate` | `employee.update` (scoped) | Signs the person out everywhere, cancels pending leave and releases the days. Not your own record. |
| `POST /employees/:id/reactivate` | `employee.update` (scoped) | Makes the record active again |
| `DELETE /employees/:id` | `employee.delete` (scoped) | 204. Soft delete, inactive records only. Disables the account and clears the person as a manager or department head. |
| `GET /employees/:id/activity` | `employee.view` (scoped) | Audit timeline: action, actor and the **names** of changed fields, never their values |
| `GET /me/profile` | session | Your own detail. 404 when no employee record is linked. |
| `PATCH /me/profile` | session | `phone`, `address`, `emergencyContact` only (assumption 8). Anything else is 422. |

Every auth event is written to `audit_logs` (`auth.login`, `auth.login_failed`, `auth.logout`,
`auth.sessions_revoked`, `auth.password_reset_requested`, `auth.password_reset`, `auth.password_changed`).
Emails are recorded; passwords and tokens never are.

`test/authorization-matrix.e2e-spec.ts` checks every protected route above for every role. Add each new
route to its table.
