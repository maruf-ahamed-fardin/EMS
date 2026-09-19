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
| `GET /departments` | `department.view` | All active departments (`?includeInactive=true`, `?q=`) with head, active employee count and position count. Not scoped: structure isn't personal data. |
| `GET /departments/head-options` | `department.create` or `department.update` | Active employees who can be made head |
| `POST /departments` | `department.create` | 201. `name`, `code` (2–10 letters or digits, upper-cased), `description`, `headEmployeeId`. 409 with `errors.name` / `errors.code` on duplicates (case-insensitive). |
| `GET /departments/:id` | `department.view` | Detail with positions, active and inactive counts, `allowedActions` |
| `PATCH /departments/:id` | `department.update` | Any field. Head must be an active employee (422). Deactivating needs zero active employees (409). |
| `DELETE /departments/:id` | `department.delete` | 204. Soft delete; its positions are soft-deleted and the head cleared. **409 while it has active employees**, with the count in the message. |
| `GET /positions` | `position.view` | `?departmentId=`, `?q=`, `?includeInactive=true`. Each with department and active holder count. |
| `POST /positions` | `position.manage` | 201. `title`, `departmentId` (null for a shared position), `level`. One title per department, shared titles included (409). |
| `PATCH /positions/:id` | `position.manage` | Refuses moving it to another department, or deactivating it, while active employees hold it (409). |
| `DELETE /positions/:id` | `position.manage` | 204. Soft delete. 409 while active employees hold it. |
| `GET /dashboard/overview` | session | Variant by `employee.view` scope: **organization** (ALL), **team** (TEAM), **personal** (OWN). Headcount, today's attendance (`expected`, `present`, `onTime`, `late`, `onLeave`, `notCheckedIn`), attention counts, pending leave (only requests the viewer may approve, never their own), who is out, new joiners, activity (all non-sign-in changes with `audit.view`; team members' changes for managers), and `me` (the viewer's own day). Cached 30 s per scope; any audited change clears it. |
| `GET /dashboard/attendance-trend` | `attendance.view` TEAM or ALL | `?range=today` (hourly check-ins so far), `week` (7 working days) or `month` (22 working days). Past days count settled rows; today uses today's expected count. |
| `GET /search` | session | `?q=` (2–100 characters) → up to 5 employees (scoped like the employee list), departments and positions |
| `GET /attendance/today` | `attendance.self` | The viewer's day: record, `onLeave`, `canCheckIn`, `canCheckOut`, `reason`, `lateAfter`. 404 without an employee record. |
| `POST /attendance/check-in` | `attendance.self` | Server time only (any time in the body is ignored). PRESENT, or LATE after start + grace; never late on a weekend or holiday. 409 when already checked in or on approved leave. |
| `POST /attendance/check-out` | `attendance.self` | 409 without a check-in, or when already checked out. Sets worked minutes. |
| `GET /attendance` | `attendance.view` (scoped) | Records with `page`, `limit`, `from`, `to`, `employeeId`, `departmentId`, `status`. `corrected` marks records an administrator changed. |
| `GET /attendance/summary` | `attendance.view` (scoped) | `?from=&to=&employeeId=` → counts by status, present rate, average worked minutes, total late minutes |
| `POST /attendance` | `attendance.manage` | 201. A record for a day that has none: `employeeId`, `workDate` (not in the future), `firstIn`/`lastOut` as `HH:mm` in the organization's time zone, optional `status`, required `note`. 409 when the day has a record. |
| `PATCH /attendance/:id` | `attendance.manage` (scoped) | Correction with the same fields. Status is derived from the times unless given; ABSENT, ON_LEAVE, HOLIDAY and WEEKEND can't carry times. Adds ADMIN punches and an `attendance.corrected` audit entry with before and after. |
| `POST /attendance/close-day` | `attendance.manage` | `{ date }` → gives everyone without a record HOLIDAY, WEEKEND, ON_LEAVE or ABSENT. Idempotent. Today only from 23:55. The server also does this by itself every 10 minutes and at start-up (`JOBS_ENABLED`). |
| `GET /settings/attendance`, `PATCH /settings/attendance` | `settings.manage` | `timeZone`, `weekendDays` (0 = Sunday), `workdayStart` (`HH:mm`), `graceMinutes`. Applies from now on. |
| `GET /holidays` | session | `?year=` |
| `POST /holidays`, `DELETE /holidays/:id` | `settings.manage` | Adding a holiday for a closed day turns its absences into HOLIDAY; removing it turns them back. 409 for a date that is already a holiday. |
| `POST /leave/preview` | `leave.create` | `{ leaveTypeId, startDate, endDate }` (same calendar year) → `days` (working days only), `workingDays`, `excludedDays` with the weekend or holiday name, `available` and `availableAfter` (null for unpaid types), `overlaps`, and `problems`: everything that would stop the request, in plain words. Saves nothing. |
| `POST /leave/requests` | `leave.create` | 201. The preview plus a required `reason`. 409 with the first problem (past start, before joining, no working days, overlap, not enough balance). Adds the days to `pending`. One request per person at a time (advisory lock), so parallel submits can't overdraw. |
| `GET /leave/requests` | session | Your own requests plus those in your `leave.view` scope. `page`, `limit`, `status`, `employeeId`, `year`, `mine=true`, and `reviewable=true` (pending requests you may decide, never your own, oldest first). Each item carries `allowedActions` and `balanceAvailable`. |
| `GET /leave/requests/:id` | session | 404 unless it is yours or in your `leave.view` scope |
| `PATCH /leave/requests/:id/approve` | `leave.approve` (scoped) | Optional `note`. 403 for your own request, 409 when already decided. Moves the days from `pending` to `used` and turns attendance rows without a check-in in the range into ON_LEAVE, in one transaction. |
| `PATCH /leave/requests/:id/reject` | `leave.reject` (scoped) | Required `note`, shown to the requester. Releases the pending days. |
| `PATCH /leave/requests/:id/cancel` | session | Your own request, or anyone's with `leave.approve` at ALL. Pending, or approved and not yet started; 409 once approved leave has started (HR adjusts the balance instead). Returns the days. |
| `GET /leave/balances` | session | `?employeeId=&year=`. Your own always; someone else's only in your `leave.view` scope (an empty list otherwise). `available = allocated + carriedForward − used − pending`. |
| `PATCH /leave/balances/:id` | `leave.manage_balances` | `allocated` and/or `carriedForward` with a required `note`; audited as `leave_balance.adjusted`. 400 when the total would drop below the days used or pending. |
| `POST /leave/balances/allocate` | `leave.manage_balances` ALL | `{ year }`, this year or next → creates missing balances: prorated for that year's joiners, with unused days carried forward up to the type's cap. The server also does this at start-up and every hour (`JOBS_ENABLED`), so 1 January needs nobody. |
| `GET /leave/types` | session | Active types; `?includeInactive=true` with `leave.manage_types` |
| `POST /leave/types`, `PATCH /leave/types/:id`, `DELETE /leave/types/:id` | `leave.manage_types` | 409 for a duplicate name or code, and when deactivating or deleting a type that pending requests use. A new paid type gives everyone this year's balance. A changed allowance applies to balances created afterwards. Delete is soft. |

Every auth event is written to `audit_logs` (`auth.login`, `auth.login_failed`, `auth.logout`,
`auth.sessions_revoked`, `auth.password_reset_requested`, `auth.password_reset`, `auth.password_changed`).
Emails are recorded; passwords and tokens never are.

`test/authorization-matrix.e2e-spec.ts` checks every protected route above for every role. Add each new
route to its table.
