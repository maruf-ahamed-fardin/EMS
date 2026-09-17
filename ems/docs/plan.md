# Employee Management System (EMS): plan

Status: **decided; Phases 1–4 built and tested against PostgreSQL** (2026-09-17). Phase 5 is next.
Date: 2026-09-17
Source: the "Master prompt: production employee management system" specification.

> **Decisions taken on 2026-09-17** (these override the recommendations in section 0 where they differ)
>
> - **D1:** the EMS lives **inside `selorax-teamprofile`**, as a self-contained workspace in `ems/`
>   (its own `package.json`, lockfile, lint and tests). The Team-SeloraX app at the repo root is unchanged.
>   Paths in section 2 such as `selorax-ems/backend` are `ems/backend` in practice.
> - **D2–D7:** the recommendations are accepted as written.
> - **Local services:** Docker Desktop (Postgres and Mailpit in `ems/docker-compose.yml`).
>   MinIO is no longer published on Docker Hub, so the S3-compatible image for D4 is chosen in Phase 8.
> - **Visual direction:** `plan-preview.html` is followed where it differs from section 11 (violet brand
>   `#5B4BFF`, Plus Jakarta Sans + Geist Mono, light and dark themes).
> - **Versions:** NestJS 11, Prisma 7.10 and TypeScript 6 rather than the newest majors. See
>   `architecture.md`, "Dependencies".

This plan covers the whole specification. It answers §52 (before coding) and sets out the order of work in §45.
Read section 0 first. It lists the decisions that change what gets built.

---

## 0. Decisions needed before Phase 1

| # | Decision | Recommendation | Why it matters |
|---|---|---|---|
| D1 | **Where does the EMS live?** | Make it a **new repository** (`selorax-ems`) with its own monorepo. Keep `selorax-teamprofile` as it is. | The spec requires NestJS + Prisma + PostgreSQL with a separate backend. This repo's conventions (`CLAUDE.md`) are the opposite: one Next.js app, MySQL, and Drizzle. You also asked for one folder only on 2026-09-15. Putting both in one repo would break that decision or the spec. |
| D2 | **What happens to the existing HR app and its `kv_store`?** | The EMS becomes the source of truth. Import once from `kv_store`, run both in parallel for a while, then Team-SeloraX reads a public endpoint of the EMS. | Without this, the HR data lives in two places. `kv_store` also holds passwords and salaries, so the import must go through an allow-list, like `PUBLIC_USER_FIELDS`. |
| D3 | **Session model** | Opaque session cookie (httpOnly, Secure, SameSite=Lax), stored hashed in Postgres. **Not** JWTs in localStorage. | Sessions can be revoked at once (deactivating a user logs them out), and scripts can't read the token. |
| D4 | **File storage** | S3-compatible private bucket: MinIO locally, Cloudflare R2 or AWS S3 in production. | Documents must be private (§23). Signed URLs need an S3-style API. |
| D5 | **Hosting** | Frontend on Vercel or in a container. Backend and Postgres as containers (Railway, Fly, or a VPS with Docker). Managed Postgres (Neon, Supabase or RDS). | NestJS is a long-running server and doesn't fit serverless well. Scheduled jobs (absences, document expiry) need a process that keeps running. |
| D6 | **Working calendar defaults** | Time zone `Asia/Dhaka`. Weekend: Friday. Office starts 09:00 with a 15-minute grace period. All of these are editable in Settings. | "Late", "absent" and "leave days" can't be calculated without them. The spec doesn't give values, so these are only starting defaults. |
| D7 | **Email for password reset** | Use a `Mailer` interface: console output in development, SMTP or Resend in production. | Forgot password (§10) needs a way to deliver the reset link. |
| D8 | **Security precondition** | Don't put real credentials or real HR data into the project until the password and token rotation from the 2026-09-15 incident is confirmed. | Anything used on this PC between 2026-09-06 and 2026-09-15 is assumed stolen. Phases 1–12 can be built entirely on seed data. |

---

## 1. Scope

### In scope (spec §2, §45)
Authentication, roles and permissions, employees, departments, positions, dashboard, attendance, leave, documents,
in-app notifications, reports (CSV/XLSX/PDF), audit logs, users, settings, global search, tests, and deployment preparation.

### Designed for later, not built now
Payroll, performance, recruitment, onboarding, assets, email/SMS/push delivery, biometric/RFID/mobile check-in.
Each of these gets an extension point, not code:

| Future module | Extension point built now |
|---|---|
| Biometric / RFID / mobile check-in | `AttendanceRecord.source` enum, plus an `AttendanceIngestService.recordPunch()` that every source calls |
| Email / SMS / push notifications | `NotificationChannel` interface. Only `InAppChannel` is implemented. |
| Payroll / performance / assets | Self-contained Nest modules that reference `Employee.id`. The permission catalogue is data, so new permissions are seeded, not coded. |
| External HR import | `IntegrationRun` table pattern, the same idea as `sync_runs` in Team-SeloraX |

### Assumptions (the spec doesn't settle these)
1. **One organization** per deployment (not multi-tenant). Tables don't carry `organization_id`, but settings are grouped so it could be added later.
2. **Attendance vs AttendanceRecord.** `Attendance` is one row per employee per working day (the daily result). `AttendanceRecord` is each raw punch (check-in or check-out, with its source). This is what lets biometric devices plug in later.
3. **Absent** is decided by a job that runs after the day's cut-off. It applies to a working day with no check-in and no approved leave. During the day, those employees show as "Not checked in", which is the "unreported" count in §13.
4. **Leave is counted in whole working days.** Weekends and holidays are excluded. Half-day leave isn't in the spec, so the column is left out. It can be added later without changes elsewhere.
5. **Leave balances are yearly** (calendar year) per leave type. Carry-forward is a per-type setting with a cap and defaults to 0.
6. **A Holiday table** is added. It isn't in the spec's entity list, but assumption 4 can't be done correctly without it.
7. **Managers approve leave for their direct reports.** HR/Admin can approve anyone's. Nobody can approve their own request.
8. **Employees can edit only** phone, address, emergency contact and profile photo. Everything else is edited by HR.
9. **Every employee can have at most one user account.** A user can exist without an employee (e.g. an external Super Admin).
10. **Soft deletion** applies to Employee, Department, Position, LeaveType, DocumentType and Document. Audit logs, attendance and leave history are never deleted.
11. **Sensitive employee fields** (date of birth, address, emergency contact, national ID documents) need `employee.view_private`, which is added to the permission list.

---

## 2. Architecture

```
                   Browser
                      │  https://ems.selorax.io
                      ▼
      ┌──────────────────────────────────────┐
      │ Next.js (frontend/)                  │
      │  • Server components render pages    │
      │  • /api/* is rewritten to NestJS     │◄── one origin, so cookies stay first-party
      │  • TanStack Query for client data    │
      └──────────────────┬───────────────────┘
                         │ REST (JSON), session cookie forwarded
                         ▼
      ┌──────────────────────────────────────┐        ┌──────────────────────┐
      │ NestJS (backend/)                    │───────►│ S3-compatible bucket │
      │  Guards: Session → Permission        │ signed │ (private, no public  │
      │  Pipes: zod DTO validation           │  URLs  │  ACL)                │
      │  Interceptors: audit, logging        │        └──────────────────────┘
      │  Filters: problem → error format     │
      │  Scheduler: absences, doc expiry     │
      └──────────────────┬───────────────────┘
                         │ Prisma
                         ▼
                  PostgreSQL 16
```

**Key choices**

- **Same-origin proxy.** Next.js `rewrites` send `/api/:path*` to the Nest server. The browser only ever talks to one origin, so SameSite cookies work and CORS stays closed. CORS is still configured with an allow-list for local development.
- **Server components fetch through a small `serverApi()` helper.** It forwards the incoming cookie to Nest, so first paint already has data with no loading flash. Mutations and filtered tables use TanStack Query on the client.
- **One contract package.** `packages/contracts` holds the zod schemas, enums, permission keys and response types. The backend turns those schemas into DTOs with `nestjs-zod`, and the frontend uses the same schemas in React Hook Form. Validation is written once and enforced on both sides (§36). The backend never trusts the frontend's check.
- **Business rules live in services** (`LeaveService.approve`, `AttendanceService.checkIn`). Controllers only parse input, check permission and call the service. React components contain no business rules.
- **Transactions** wrap every multi-step write: approving leave (balance, request, notification, audit), creating an employee (employee, user, documents, audit), and check-in (record plus daily row).

### Repository layout

```
selorax-ems/
  package.json               npm workspaces: frontend, backend, packages/*
  docker-compose.yml         postgres:16, minio, mailpit (dev only)
  .env.example
  packages/
    contracts/               zod schemas, enums, PERMISSIONS, API types (no runtime deps beyond zod)
  backend/
    prisma/  schema.prisma  migrations/  seed.ts
    src/
      main.ts  app.module.ts
      common/     config (zod env), prisma, guards, decorators (@RequirePermission, @CurrentUser),
                  filters (error format), interceptors (audit, request id), pagination, storage, mailer
      auth/  users/  roles/  employees/  departments/  positions/  attendance/  leave/
      documents/  notifications/  reports/  audit/  dashboard/  search/  settings/
    test/        unit (*.spec.ts next to code) + e2e (supertest against a real Postgres)
  frontend/
    app/
      (auth)/login  (auth)/forgot-password  (auth)/reset-password
      (app)/layout.tsx         app shell: sidebar + header
      (app)/dashboard  employees  employees/new  employees/[id]  departments  positions
      (app)/attendance  leave  leave/requests  leave/types  documents  reports  notifications
      (app)/users  roles  audit-logs  settings
    components/ui/             shadcn/ui primitives
    components/shared/         DataTable, EmptyState, ErrorState, PageHeader, StatusBadge, KpiCard,
                               FilterSheet, ConfirmDialog, FormStepper, Can (permission gate)
    features/<module>/         api.ts (query hooks), components/, schemas re-exported from contracts
    lib/  providers/  hooks/  types/
  docs/  requirements.md  architecture.md  database.md  api.md  permissions.md
  README.md
```

---

## 3. Database design (PostgreSQL + Prisma)

Conventions: `id` is a `uuid` primary key (UUIDv7, which sorts by time). Every table has `created_at` and `updated_at`.
Soft-deleted tables have `deleted_at`, and their unique constraints are **partial indexes** (`WHERE deleted_at IS NULL`), written in raw SQL inside the migration.
Emails are stored as `citext`, so they are unique regardless of letter case.

### Entity relationships

```
Role ─< RolePermission >─ Permission
 │
 └─< User ──1:1?── Employee >── Department ─< Position
      │               │  ▲            │
      │               │  └ manager ───┘ (Department.head_employee_id → Employee)
      │               │ (self FK)
      ├─< Session     ├─< Attendance ─< AttendanceRecord
      ├─< PasswordReset
      ├─< Notification├─< LeaveBalance >── LeaveType
      └─< AuditLog    ├─< LeaveRequest >── LeaveType   (approver → User)
                      └─< Document >── DocumentType    (uploaded_by → User)

Holiday, Setting  (standalone)
```

### Tables

**Identity and access**

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `users` | email citext, password_hash, role_id, employee_id?, status (ACTIVE/INACTIVE/LOCKED), last_login_at, failed_login_count, locked_until, password_changed_at | unique(email), unique(employee_id), idx(role_id), idx(status) |
| `roles` | key (`super_admin`…), name, description, is_system | unique(key). System roles can't be deleted. |
| `permissions` | key (`employee.view`), module, description | unique(key). Seeded from `contracts/PERMISSIONS`. |
| `role_permissions` | role_id, permission_id, **scope** (OWN / TEAM / ALL) | PK(role_id, permission_id) |
| `sessions` | user_id, token_hash (sha256), expires_at, last_seen_at, ip, user_agent, revoked_at | unique(token_hash), idx(user_id), idx(expires_at) |
| `password_reset_tokens` | user_id, token_hash, expires_at, used_at | unique(token_hash), idx(user_id) |

The **scope** column is what makes permissions data instead of code. A Manager has `employee.view` with TEAM scope, an Employee has it with OWN scope, and HR has it with ALL scope. A single `ScopeService` turns scope into a Prisma `where` clause for every list and detail query.

**Organization**

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `departments` | name, code, description, head_employee_id?, is_active, deleted_at | partial unique(name), partial unique(code) |
| `positions` | title, department_id?, level?, is_active, deleted_at | partial unique(title, department_id), idx(department_id) |
| `employees` | employee_code (`SX-001`), first_name, last_name, email citext, phone, date_of_birth, gender?, address (jsonb: line1, city, postcode, country), emergency_contact (jsonb), photo_key?, department_id, position_id, manager_id?, joining_date, employment_type (FULL_TIME/PART_TIME/CONTRACT/INTERN), status (ACTIVE/INACTIVE), work_location, deactivated_at?, deleted_at | partial unique(employee_code), partial unique(email), idx(department_id), idx(position_id), idx(manager_id), idx(status), idx(joining_date), idx(created_at), trigram idx(first_name ‖ last_name) for search |
| `holidays` | date, name | unique(date) |
| `settings` | key, value jsonb, updated_by | PK(key). Typed by a zod schema per key: `attendance`, `leave`, `organization`. |

**Attendance**

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `attendances` | employee_id, work_date (date), first_in_at?, last_out_at?, worked_minutes, status (PRESENT/LATE/ABSENT/ON_LEAVE/HOLIDAY/WEEKEND), late_minutes, note, source_summary | **unique(employee_id, work_date)**, idx(work_date, status) |
| `attendance_records` | attendance_id, employee_id, type (CHECK_IN/CHECK_OUT), occurred_at, source (WEB/MOBILE/BIOMETRIC/RFID/API/ADMIN), device_id?, ip?, created_by | idx(employee_id, occurred_at), idx(attendance_id) |

**Leave**

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `leave_types` | name, code, default_days_per_year, requires_document, carry_forward_max, is_paid, is_active, deleted_at | partial unique(code) |
| `leave_balances` | employee_id, leave_type_id, year, allocated, carried_forward, used, pending (numeric(5,1)) | **unique(employee_id, leave_type_id, year)**, CHECK(used + pending ≤ allocated + carried_forward) |
| `leave_requests` | employee_id, leave_type_id, start_date, end_date, days, reason, status (PENDING/APPROVED/REJECTED/CANCELLED), reviewed_by?, reviewed_at?, review_note | idx(status), idx(employee_id, start_date), idx(leave_type_id), CHECK(end_date ≥ start_date) |

**Documents, notifications, audit**

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `document_types` | name, code, is_sensitive, has_expiry, deleted_at | partial unique(code) |
| `documents` | employee_id, document_type_id, title, storage_key, mime_type, size_bytes, sha256, expires_at?, uploaded_by, deleted_at | unique(storage_key), idx(employee_id), idx(expires_at) WHERE deleted_at IS NULL |
| `notifications` | user_id, type, title, body, link, entity_type?, entity_id?, read_at?, dedupe_key? | idx(user_id, read_at, created_at desc), unique(user_id, dedupe_key) |
| `audit_logs` | actor_user_id?, action (`employee.updated`), entity_type, entity_id, before jsonb?, after jsonb?, ip?, user_agent?, request_id, created_at | idx(entity_type, entity_id), idx(actor_user_id), idx(created_at desc), idx(action). No updated_at: rows are append-only. |

**Why this is normalized, not duplicated:** a name lives only on `employees`, and `users` links to it. Department and position are foreign keys, never copied strings. Leave `days` is stored on the request because it is a fact frozen at approval time (holidays can change later).

---

## 4. Roles and permissions

### Permission catalogue (`packages/contracts/src/permissions.ts`)

```
employee.view  employee.view_private  employee.create  employee.update  employee.delete
department.view  department.create  department.update  department.delete
position.view  position.manage
attendance.view  attendance.manage  attendance.self       (check in/out for yourself)
leave.view  leave.create  leave.approve  leave.reject  leave.manage_types  leave.manage_balances
document.view  document.upload  document.delete
notification.view
report.view  report.export
user.view  user.manage  role.manage
audit.view
settings.manage
```

The keys added beyond the spec's examples (`employee.view_private`, `position.*`, `attendance.self`, `leave.manage_*`, `report.export`, `role.manage`, `notification.view`) exist because a spec role needs a capability that its examples don't separate out.

### Default matrix (seeded, editable in Roles & Permissions)

| Permission | Super Admin | HR/Admin | Manager | Employee |
|---|---|---|---|---|
| employee.view | ALL | ALL | TEAM | OWN |
| employee.view_private | ALL | ALL | – | OWN |
| employee.create / update / delete | ALL | ALL | – | – (own allowed fields go through `/me`) |
| department.* / position.* | ALL | ALL | view | view |
| attendance.view | ALL | ALL | TEAM | OWN |
| attendance.manage | ALL | ALL | – | – |
| attendance.self | ✓ | ✓ | ✓ | ✓ |
| leave.view | ALL | ALL | TEAM | OWN |
| leave.create | ✓ | ✓ | ✓ | ✓ |
| leave.approve / reject | ALL | ALL | TEAM | – |
| leave.manage_types / manage_balances | ALL | ALL | – | – |
| document.view | ALL | ALL | TEAM (non-sensitive types only) | OWN |
| document.upload | ALL | ALL | – | OWN |
| document.delete | ALL | ALL | – | – |
| report.view / export | ALL | ALL | TEAM | – |
| user.view / user.manage | ✓ | view | – | – |
| role.manage | ✓ | – | – | – |
| audit.view | ✓ | ✓ (non-security events) | – | – |
| settings.manage | ✓ | attendance and leave sections | – | – |

TEAM means employees whose `manager_id` is the current user's employee, one level down. Walking the whole reporting tree is a single recursive CTE if that is ever wanted.

### Enforcement

- **Backend (security):** `@RequirePermission('leave.approve')` on the handler. `PermissionGuard` loads the role's permissions (cached per session for 60 s), rejects with 403, and puts the scope on the request. Services call `scope.employeeWhere(user, 'leave.view')`. Row-level checks (such as "is this request in my team?") happen inside the service, so a missing guard can't leak data.
- **Frontend (UI only):** `GET /auth/me` returns `permissions: {key: scope}`. `<Can permission="employee.create">` and `useCan()` hide controls, and the sidebar is built from the same map. Nothing on the frontend is relied on for security.
- **Self-approval blocked:** `LeaveService.approve` rejects when `request.employee_id === actor.employee_id`, whatever the role.

---

## 5. Authentication

| Concern | Design |
|---|---|
| Password hashing | **argon2id** (memory 19 MiB, t=2, p=1). Minimum 10 characters, checked against a common-password list. |
| Login | `POST /auth/login`. On success, creates a 32-byte random token and stores its sha256 in `sessions`. Cookie `ems_session`: httpOnly, Secure, SameSite=Lax, Path=/. |
| Session lifetime | 8 h idle, 7 days absolute. Session is refreshed on activity (`last_seen_at` is written at most once a minute). |
| Logout | `POST /auth/logout` revokes the session row and clears the cookie. "Log out other sessions" is on the Security settings page. |
| Deactivation | Deactivating a user or employee revokes all sessions in the same transaction. |
| Abuse protection | `@nestjs/throttler`: login allows 5 per minute per IP and email, and forgot-password allows 3 per hour. After 10 consecutive failures the account locks for 15 min. Responses are always the generic "Email or password is incorrect". |
| Forgot / reset | Always returns 202 with the same body, so it can't be used to check whether an email exists. The token is 32 random bytes, stored hashed, valid 30 min and single use. A reset revokes all sessions. |
| CSRF | SameSite=Lax cookie **plus** an `Origin`/`Sec-Fetch-Site` check on every non-GET request **plus** a double-submit `x-csrf-token` header. |
| Headers | `helmet` on Nest. On Next: CSP, `frame-ancestors 'none'`, HSTS, `Referrer-Policy: strict-origin-when-cross-origin`. |
| Protected routes | Next middleware redirects to `/login?next=` when there is no cookie (a fast path, not security). The `(app)` layout calls `/auth/me` on the server, and every API route is guarded on the backend. |
| Audit | `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_reset_requested`, `auth.password_reset`. Emails are stored, passwords and tokens never. |

---

## 6. API

Base path `/api/v1`. JSON only, except file uploads (multipart) and exports (CSV/XLSX/PDF streams).

### Response formats

```jsonc
// single resource
{ "data": { ... } }
// list
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 } }
// error (spec §35), produced by one global exception filter
{ "statusCode": 422, "message": "Validation failed", "errors": { "email": "Invalid email address" }, "requestId": "01J…" }
```

Lists take `?page=&limit=` (limit ≤ 100), `?sort=field:asc` (only allow-listed fields), `?q=` and module filters.
Production error responses never include stack traces. 500 errors return `"message": "Something went wrong"` plus the `requestId`, which matches the log.

### Endpoints by module

| Module | Endpoints | Permission |
|---|---|---|
| auth | `POST /auth/login` `POST /auth/logout` `GET /auth/me` `POST /auth/forgot-password` `POST /auth/reset-password` `POST /auth/change-password` | public / session |
| me | `GET /me/profile` `PATCH /me/profile` (allowed fields only) `POST /me/photo` | session |
| employees | `GET /employees` `POST /employees` `GET /employees/:id` `PATCH /employees/:id` `POST /employees/:id/deactivate` `POST /employees/:id/reactivate` `DELETE /employees/:id` (soft) `GET /employees/:id/activity` `GET /employees/check-unique?email=&code=` | employee.* |
| departments | `GET /departments` `POST` `GET /:id` `PATCH /:id` `DELETE /:id` (409 if it still has active employees) `GET /:id/employees` | department.* |
| positions | `GET /positions` `POST` `PATCH /:id` `DELETE /:id` | position.* |
| attendance | `GET /attendance` `GET /attendance/today` `GET /attendance/summary?from=&to=` `POST /attendance/check-in` `POST /attendance/check-out` `PATCH /attendance/:id` (admin correction, audited) | attendance.* |
| leave | `GET /leave/requests` `POST /leave/requests` `GET /leave/requests/:id` `PATCH /leave/requests/:id/approve` `PATCH /leave/requests/:id/reject` `PATCH /leave/requests/:id/cancel` `GET /leave/balances?employeeId=&year=` `PATCH /leave/balances/:id` `GET/POST/PATCH/DELETE /leave/types` `POST /leave/preview` (counts days before submitting) | leave.* |
| documents | `GET /employees/:id/documents` `POST /employees/:id/documents` (multipart) `GET /documents/:id/url` (60 s signed URL) `DELETE /documents/:id` `GET/POST/PATCH /document-types` | document.* |
| notifications | `GET /notifications` `GET /notifications/unread-count` `PATCH /notifications/:id/read` `PATCH /notifications/read-all` | notification.view |
| dashboard | `GET /dashboard/overview` `GET /dashboard/attendance-trend?range=today|week|month` | scope-aware |
| reports | `GET /reports/employees` `GET /reports/attendance` `GET /reports/leave` `GET /reports/departments`, each with `?format=json|csv|xlsx|pdf` | report.view / report.export |
| search | `GET /search?q=` returns `{ employees, departments, positions }` with at most 5 each, scoped | session |
| users | `GET /users` `POST /users` `PATCH /users/:id` (role, employee link) `POST /users/:id/activate` `POST /users/:id/deactivate` `POST /users/:id/send-reset` | user.* |
| roles | `GET /roles` `GET /permissions` `PUT /roles/:id/permissions` | role.manage |
| audit | `GET /audit-logs?actor=&entity=&action=&from=&to=` | audit.view |
| settings | `GET /settings` `PATCH /settings/:section` | settings.manage |
| holidays | `GET /holidays?year=` `POST` `DELETE /:id` | settings.manage |
| health | `GET /health` (liveness) `GET /health/ready` (database + storage) | public |

`GET /dashboard/overview` returns the shape in §46. It is scoped: a Manager gets team numbers, and an Employee gets a personal variant (`me.attendanceToday`, `me.leaveBalances`, `me.pendingRequests`). It is cached in memory for 30 s per scope key and cleared on writes that affect it.

---

## 7. Core business rules

### Attendance
- **Check-in:** fails with 409 if the employee is inactive, already checked in today, or on approved leave. It creates the `attendance_records` row and upserts `attendances` in one transaction. Status is `LATE` when `occurred_at` > start + grace, otherwise `PRESENT`.
- **Check-out:** needs an open check-in. Sets `last_out_at` and recalculates `worked_minutes` from paired records.
- **Server time only:** the client never sends a timestamp for self check-in. Admin corrections may set times and are audited with before/after values.
- **Nightly close** (`@nestjs/schedule`, 23:55 Asia/Dhaka, idempotent): creates `ABSENT`, `ON_LEAVE`, `HOLIDAY` or `WEEKEND` rows for active employees without a row, and notifies HR of absences and missing check-outs.
- **Future devices** call `AttendanceIngestService.recordPunch({employeeId, occurredAt, source, deviceId})`, the same code path as the web.

### Leave
- **Preview/submit:** `days` = working days between start and end, minus weekends and holidays. It is rejected if 0, if it overlaps a pending or approved request, or if `available = allocated + carried − used − pending` is below `days`. On submit, `pending += days`, in a transaction with `SELECT … FOR UPDATE` on the balance row.
- **Approve:** status must be PENDING, the reviewer must be in scope and not the requester. Then `pending −= days`, `used += days`, status and reviewer are set, future attendance rows in the range are marked ON_LEAVE, the employee is notified, and the action is audited. All of that is one transaction.
- **Reject / cancel:** `pending −= days`, a note is required on reject, and the employee is notified. Cancelling an approved leave that has already started isn't allowed (HR adjusts it instead).
- **Yearly allocation:** a job on 1 January (also runnable by hand) creates next year's balances from `default_days_per_year` plus a capped carry-forward.
- The DB CHECK constraint is the last line of defence. Balances are never calculated on the client.

### Documents
- **Upload:** streamed through Nest (max 10 MB). The MIME type is sniffed from the file's magic bytes (`file-type`), and the allow-list is PDF, PNG, JPEG, DOCX. The storage key is `employees/{employeeId}/{uuidv7}`, never the original filename. sha256 is stored, and the action is audited.
- **Access:** `GET /documents/:id/url` checks permission and scope (Manager can't open `is_sensitive` types), then returns a **60-second** presigned GET with `Content-Disposition` set, and audits `document.accessed`. The URL is never stored or cached.
- **Expiry:** a daily job notifies HR and the employee at 30, 7 and 0 days (`dedupe_key` stops repeats) and feeds "Needs your attention".

### Employees
- **Creating an employee** writes, in one transaction: the employee row, optional documents (uploaded to a `pending/` prefix first, moved on commit, cleaned by a job if abandoned), an optional user account with a reset link emailed instead of a password, leave balances for the current year, and the audit entry.
- **Duplicates:** the unique constraints are what actually stop them. The form also calls `check-unique` as you type. The database error is mapped to `409 { errors: { email: "Already used by SX-014" } }`.
- **Deactivating** sets the status, revokes sessions, cancels pending leave (releasing the days) and records the audit. **Delete** is soft and is only offered to Super Admin.

---

## 8. Audit logging

- `AuditService.record(tx, {action, entityType, entityId, before, after})` runs **inside the same transaction** as the change, so a rolled-back change leaves no audit row and a committed change always has one.
- `before`/`after` go through a per-entity **redaction allow-list**. `password_hash`, token hashes and document storage keys are never written.
- Actor, IP, user agent and request id come from an `AsyncLocalStorage` request context that an interceptor sets.
- Events: auth events, `employee.created/updated/deactivated/reactivated/deleted`, `department.*`, `position.*`, `attendance.corrected`, `leave.requested/approved/rejected/cancelled`, `leave_balance.adjusted`, `document.uploaded/accessed/deleted`, `user.*`, `role.permissions_changed`, `settings.updated`.
- Recent Activity on the dashboard and the employee Activity tab read from this table, with scope applied.

---

## 9. Notifications

- `NotificationService.notify({userIds, type, title, body, link, entity, dedupeKey})` writes rows, then hands each one to the registered `NotificationChannel`s. Only `InAppChannel` exists now. `EmailChannel`, `SmsChannel` and `PushChannel` implement the same interface later, along with a per-user preference table.
- Triggers: leave requested (to manager and HR), leave approved or rejected (to the employee), document expiring, employee created (to HR), attendance issue (to HR), password changed (to the user).
- The header bell polls `unread-count` every 60 s with TanStack Query and refetches when the window regains focus. No websockets for now.

---

## 10. Reports

- Every report is a backend query with filters (date range, department, employee, status), scoped and paginated for JSON.
- Exports **stream** from a Prisma cursor. CSV uses `csv-stringify`, XLSX uses the `exceljs` streaming writer, and PDF uses `pdfkit` (a table layout with a filter summary header). Exports are capped at 50 000 rows, and a larger request gets 413 with "narrow the date range".
- `report.export` is audited (`report.exported`, with filters).

| Report | Rows | Summary |
|---|---|---|
| Employees | code, name, department, position, manager, type, status, joining date | headcount by status/type |
| Attendance | employee, date, in, out, hours, status, late minutes | present %, late count, absences per employee |
| Leave | employee, type, dates, days, status, reviewer | days taken per type, balance remaining |
| Departments | department, head, headcount, active, joined in period, left in period | distribution |

---

## 11. Frontend

### Routes

| Route | Page | Visible with |
|---|---|---|
| `/login` `/forgot-password` `/reset-password` | Auth | public |
| `/dashboard` | Admin, manager or employee variant | everyone |
| `/employees` | Table with filters. Cards on mobile. | employee.view (TEAM+) |
| `/employees/new` | 5-step form | employee.create |
| `/employees/[id]` | Profile tabs: Overview · Personal · Employment · Attendance · Leave · Documents · Activity | employee.view in scope |
| `/profile` | Own profile (same component, allowed fields editable) | everyone |
| `/departments` `/departments/[id]` | List and detail | department.view |
| `/positions` | List | position.view |
| `/attendance` | Today summary, records table, check-in/out card | attendance.view / self |
| `/leave` | My balances and requests, request form | leave.create |
| `/leave/requests` | Review queue | leave.approve |
| `/leave/types` | Type management | leave.manage_types |
| `/documents` | All documents with expiry filter (own list for employees) | document.view |
| `/reports` | Report picker, filters, preview, export | report.view |
| `/notifications` | Notification centre | everyone |
| `/users` `/roles` `/audit-logs` `/settings` | Administration | user.view / role.manage / audit.view / settings.manage |

### Application shell
- **Desktop (≥1024px):** sidebar 248 px, collapsible to 64 px (icons with tooltips), state kept in a cookie so there is no layout shift. Header: page title, greeting on the dashboard, ⌘K search, bell, profile menu.
- **Tablet (768–1023px):** collapsed sidebar by default.
- **Mobile (<768px):** sidebar becomes a `Sheet` drawer from a menu button. Search becomes a full-screen dialog. Tables become card lists. Filters go into a bottom sheet. Buttons are at least 44 px tall.
- **Navigation** is built from one config `[{label, href, icon, permission}]` filtered through `useCan`, so employees get the short menu automatically.

### Reusable components (built once in Phase 1–3)
`AppShell`, `SidebarNav`, `PageHeader`, `DataTable` (TanStack Table + URL-synced filters/sort/page + mobile card renderer), `FilterBar`/`FilterSheet`, `StatusBadge` (icon + text + colour, never colour alone), `KpiCard`, `EmptyState`, `ErrorState` (with retry), `Skeleton*` per layout, `ConfirmDialog`, `FormField` wrappers for RHF, `FormStepper`, `DatePicker`/`DateRangePicker`, `EmployeeCombobox`, `AvatarStack`, `FileDropzone`, `Can`, `UnsavedChangesGuard`, `Toast` (sonner).

### UI states (§32), done the same way everywhere
- **Loading:** `loading.tsx` per route with layout-shaped skeletons. TanStack `isFetching` shows a thin progress bar (refreshing) while old data stays visible.
- **Empty:** `EmptyState` with a sentence and the primary action if the user may take it ("No employees yet. Add your first employee to get started.").
- **Error:** `error.tsx` plus `ErrorState` ("We couldn't load employees." [Try again]).
- **Unauthorized:** a 403 page explaining which access is missing. 401 redirects to login.
- **Not found:** `not-found.tsx` per resource.
- **Success:** toasts that name the result ("Leave approved for Rahim Ahmed").
- **Forms:** required asterisk, inline zod messages, submit disabled and spinner while pending, server field errors mapped back into the form, an idempotency key on create so a double click can't create a duplicate, and a leave-page guard when the form has unsaved changes.

### Visual direction
Light-first. Neutral slate-blue greys, one brand colour (deep blue `#2E4BDB`, a placeholder until the SeloraX brand colour is confirmed), and semantic green/amber/red for status only.
Font: Geist for the UI with tabular numbers. Radius 8 px on inputs/buttons and 12 px on panels. 1 px borders, with shadow only on popovers and dialogs. No gradients or glass.
See the visual preview for how it looks.

---

## 12. Cross-cutting production concerns

| Area | Plan |
|---|---|
| Config | `@nestjs/config` + zod schema: fail fast at boot and never print values. `.env.example` has placeholders only. Next uses a separate zod-validated `env.ts`. |
| Logging | `nestjs-pino` in JSON with request id, user id, route and duration. Redacts `password`, `token`, `authorization`, `cookie` and `*.storageKey`. Auth events and job failures are logged at `warn`/`error`. |
| Rate limiting | Global 300/min per session. Auth routes have stricter limits (§5). In-memory storage for a single instance. Switch to the Redis store when there is more than one instance. |
| Caching | Departments/positions lists: in-memory for 5 min, cleared on write. Dashboard: 30 s per scope. Nothing sensitive is cached per user in shared caches. Next pages are `dynamic`, with no ISR for private data. |
| Performance | Indexes in §3. Prisma `select` with explicit fields (which also blocks accidental leaks). `include` for relations to avoid N+1 queries. Dashboard counts use `groupBy`/raw aggregate SQL. Recharts is loaded with `next/dynamic`. |
| Accessibility | shadcn/Radix primitives (focus trap, ARIA). Visible focus ring. Labels on every input. Status uses icon + text. Contrast AA checked. `axe` in Playwright smoke tests. |
| Security headers / CORS | helmet. CORS allow-list from env (dev only, since production is same-origin). Body size limits. `trust proxy` set correctly for IP-based limits. |
| Dependencies | Exact versions in the lockfile, `npm ci` in CI, `npm audit` in CI, Renovate later. Given the September incident, CI also greps config files (`*.config.*`) for the known payload pattern, and the repo uses the global git guard hook. |
| Deployment | Dockerfiles for backend and frontend (multi-stage, non-root user). `prisma migrate deploy` runs as a release step, never at app start. `/health/ready` for orchestration. GitHub Actions: lint → typecheck → unit → e2e (Postgres service) → build. |
| Backups | Managed Postgres point-in-time recovery plus bucket versioning. Documented in the README. |

---

## 13. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Jest (Nest default) | Leave day counting (weekends, holidays, year boundary), balance arithmetic, late/absent status, scope → where-clause, audit redaction, password policy |
| API e2e | Jest + supertest + real Postgres (docker compose, fresh schema per run) | Every endpoint's happy path, plus the **authorization matrix**: each role × each protected route gives the expected 200/403/404 |
| Required negative tests (§40) | e2e | Employee A can't read or get a URL for Employee B's documents (404, not 403, so existence isn't revealed). A manager can't PATCH settings (403). A manager can't approve another team's leave (403). Nobody can approve their own leave. A deactivated user's session is rejected. A double approval doesn't double-subtract. Two concurrent submits can't overdraw a balance. |
| Frontend | Vitest + Testing Library | Form schemas and step logic, `Can`, DataTable URL state |
| Smoke | Playwright at 375 px and 1280 px | Login → dashboard → employee profile → approve leave. Employee: check in → request leave. Includes an axe check. |

Gate after every module (§53): `typecheck`, `lint`, `test`, `prisma migrate diff` shows no drift, a manual check of the pages at 375/768/1280, then commit.

---

## 14. Seed data (development only)

`prisma/seed.ts` refuses to run when `NODE_ENV=production`. Every seeded email uses `@demo.selorax.test`, and a visible "Demo data" badge appears in the header when the `DEMO_MODE` flag is set.

- **Users:** `superadmin@`, `hr@`, `manager@` (Development head), `employee@`. The password comes from `SEED_PASSWORD`, which is never hardcoded.
- **Organization:** 5 departments (Development, Marketing, HR, Finance, Sales) and 14 positions.
- **Employees:** 60, with Bangladeshi names, managers assigned, and joining dates spread over 3 years.
- **Records:** 60 working days of attendance generated with realistic late/absent rates. Leave types (Annual 18, Sick 14, Casual 10, Unpaid). Mixed pending/approved/rejected requests. Documents as generated PDFs, some expiring within 30 days. Notifications and audit history matching the generated events.

---

## 15. Roadmap

Each phase ends with the §53 gate, a commit on a feature branch, and a short summary (what was built, files, DB changes, endpoints, tests, what remains).

| Phase | Deliverable | Done when |
|---|---|---|
| **1 Architecture** | Monorepo, docker compose (Postgres, MinIO, Mailpit), Nest skeleton with config/logging/error filter/health, Prisma baseline migration of all tables in §3, contracts package, Next app with Tailwind + shadcn + theme tokens, AppShell with empty routes guarded, CI, `docs/*` first versions | `docker compose up` + `npm run dev` shows the shell. CI is green. Migration applies to a clean DB. |
| **2 Auth & RBAC** | Login/logout/me/forgot/reset/change password, sessions, lockout, throttling, CSRF, permission guard + scope service, roles/permissions seed, `Can`, permission-driven sidebar, login pages | The authorization matrix e2e suite passes for auth + a probe endpoint |
| **3 Employees** | CRUD, deactivate/reactivate, list with search/filter/sort/pagination, profile tabs (Overview, Personal, Employment, Activity), 5-step create form, uniqueness checks, `/profile` self-edit | Employee e2e + negative tests pass. Mobile cards work at 375 px. |
| **4 Departments & positions** | CRUD, head assignment, employee counts, department detail, safe delete | Delete with active employees returns 409 with the count |
| **5 Dashboard** | `/dashboard/overview` + trend, KPI cards, attendance chart, attention list, recent employees, department distribution, leave panel, activity feed, three role variants, ⌘K global search | Every number traced to a query. Seeded values match SQL spot checks. |
| **6 Attendance** | Check-in/out, records table with filters, admin correction, nightly close job, holidays + attendance settings, profile Attendance tab | Late/absent/leave tests pass, including across midnight Asia/Dhaka |
| **7 Leave** | Types, balances, preview, request, approve/reject/cancel, yearly allocation job, review queue, profile Leave tab | Concurrency test: parallel submits can't overdraw |
| **8 Documents** | Storage adapter, upload, signed access, delete, document types, expiry job, Documents tab + `/documents` | Cross-employee access test returns 404. No storage key appears in any response. |
| **9 Notifications** | Service + channel interface, triggers from phases 3–8, bell, `/notifications` | Every trigger in §9 creates exactly one row (dedupe) |
| **10 Reports** | Four reports, JSON preview, CSV/XLSX/PDF streaming export | A 50k-row export streams under a memory ceiling |
| **11 Audit** | Audit viewer with filters and diff view. Coverage check of every event in §8. | A test fails if a mutating endpoint writes no audit row |
| **12 Hardening** | Security review, headers/CSP, axe pass, Playwright smoke at 375/1280, query review with `EXPLAIN`, Dockerfiles, deploy docs, backup notes, users/roles/settings screens completed | Definition of done (§54) re-checked for every module |

Phases 1–2 are the foundation, and nothing else starts before they pass. From Phase 3 on, the order follows the spec. Notifications (9) and audit (11) are *wired in* as each earlier module is built, and their own phases add the UI and coverage tests.

---

## 16. Relationship to Team-SeloraX (this repository)

- No change to this repo in Phases 1–12.
- After the EMS is live and the `kv_store` import has been reviewed:
  1. The EMS exposes `GET /public/team/:username`, which returns only the public card fields and is rate limited.
  2. Team-SeloraX's `src/lib/team.ts` switches its source from `kv_store` to that endpoint. `PUBLIC_USER_FIELDS` stays as a second allow-list.
  3. The unfinished `src/server/**` MySQL tables (members, member_profiles…) are retired rather than connected, since the EMS replaces them.
- That migration is a separate plan, written once D2 is decided.

---

## 17. Risks

| Risk | Mitigation |
|---|---|
| The scope is large. Twelve phases can drift into half-finished modules. | Strict phase gate. Nothing is merged without backend + UI + states + tests. Phase 12 has no new features. |
| Wrong late/absent results because of time zones | All timestamps stored as `timestamptz`. The working day is calculated in the org time zone in one function, with unit tests around midnight and DST-free zones. |
| Leave balance corruption | Row lock + CHECK constraint + transaction + concurrency test |
| Data leaks through over-broad responses | Explicit Prisma `select` per view model, e2e matrix, `employee.view_private` split, 404 for out-of-scope resources |
| Supply-chain compromise (seen on 2026-09-15) | Lockfile + `npm ci`, CI payload grep, git guard hook, no real credentials until rotation is confirmed |
| Two HR systems diverging during the switch-over | D2: one-way import, a read-only period for the old HR app, then Team-SeloraX switches over |
