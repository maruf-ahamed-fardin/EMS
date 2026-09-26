# Architecture

The full design is in [plan.md §2 and §12](plan.md). This page records how it was actually built and
why it differs from the plan, where it does.

## Request path

```
Browser ── same origin ──► Next.js (frontend, :3000)
                             │  proxy.ts: no session cookie → /login?next=…   (fast path, not security)
                             │  (app)/layout.tsx: validates the session on the server
                             │  next.config.ts rewrites /api/* ───────────────┐
                             ▼                                                ▼
                        rendered pages                            NestJS (backend, :4000)
                                                                   requestContextMiddleware
                                                                     → request id, no-store, AsyncLocalStorage
                                                                   helmet, cookie-parser, 1 MB JSON limit
                                                                   pino-http (redacted, request id on every line)
                                                                   ZodValidationPipe → handler → service
                                                                   ApiExceptionFilter → { statusCode, message, errors?, requestId }
                                                                     │ Prisma (driver adapter: pg)
                                                                     ▼
                                                                   PostgreSQL 16
```

The browser never talks to the API origin directly, so the session cookie is first-party and CORS stays
closed (`CORS_ORIGINS` exists only for development tools).

## Backend layout (`backend/src`)

| Path | Role |
|---|---|
| `main.ts`, `configure-app.ts` | Bootstrap. `configureApp` is shared with the e2e tests, so they run the real middleware stack. |
| `config/` | `parseEnv` (zod) and the global `ConfigModule`. Inject with `@InjectConfig()`. |
| `common/request-context.ts` | Request id and the AsyncLocalStorage context used by logging, errors, the session guard and audit. |
| `common/errors/` | The one exception filter and zod → field error mapping. |
| `common/logging/` | pino options, redaction list. |
| `prisma/` | `PrismaService`, global. |
| `auth/` | Login, sessions, password reset and change; the CSRF, session, throttle and permission guards (applied globally in that order); `ScopeService`; `@Public()`, `@RequirePermission()`, `@CurrentAuth()`. |
| `audit/` | `AuditService.record()` and `skip()`, per-entity allow-lists in `redaction.ts`, the coverage interceptor and `@NoAudit` (`audit-coverage.ts`), and the viewer API (`AuditLogService`: filters, record names, before/after with private fields hidden). |
| `mail/` | The `Mailer` interface: console (development), SMTP (production), memory (tests). |
| `catalogue/` | `syncCatalogue()`: permissions and system roles from contracts. `sync-cli.ts` is the release step. |
| `roles/` | `GET /roles`, `GET /permissions`. |
| `employees/` | Employee CRUD, status changes, activity, `/me/profile`. Explicit selects in `employee-view.ts`; filters, sort and code allocation in `employee-query.ts`. |
| `organization/` | Departments and positions: CRUD, head, counts, the "no active employees" delete rules. |
| `calendar/` | The working calendar: `work-calendar.ts` (pure date functions in the organization's time zone) and `CalendarService` (attendance settings with plan D6 defaults, holidays). |
| `dashboard/` | Overview, attendance trend, global search, and `DashboardCache` (cleared by `AuditService` on every non-sign-in change). |
| `attendance/` | `attendance-rules.ts` (late, worked minutes, closing status: pure), `AttendanceIngestService.recordPunch()` (the one path for web and future devices), `AttendanceService` (lists, summary, corrections, closing days) and the scheduler. |
| `settings/` | Attendance settings and holidays. |
| `leave/` | Leave types, balances (`leave-rules.ts`: day counting, proration, carry-forward), requests and decisions, and the balance scheduler. |
| `reports/` | `definitions.ts` (each report's filters, scope, columns, rows and totals), `ReportsService` (preview; export with the row cap, audit and batched streaming), and `writers/` (CSV, a small streaming XLSX writer, PDF with pdfkit) behind one `ReportWriter` interface that waits for slow clients. |
| `notifications/` | `NotificationService.notify()` (writes rows, optionally in the caller's transaction, then hands them to each `NotificationChannel`; only the in-app channel exists), recipient helpers (`usersWithAll`, `accountOf`), the API, and `wording.ts`. Global, like audit. |
| `documents/` | `storage/storage.ts` (`DocumentStorage`: local disk with encrypted 60-second link tokens, or S3 with presigned URLs), `sniff.ts` (type from the bytes), upload, visibility (`documentVisibleWhere`, shared with the dashboard), `GET /files/:token`, document types and the expiry reminders. |
| `common/clock.ts` | `Clock`, injected wherever "now" matters; tests replace it with `FixedClock`. |
| `health/` | `GET /health` (liveness) and `GET /health/ready` (database). |
| `generated/prisma/` | Generated client, not committed. `yarn db:generate` rebuilds it. |

Modules from later phases (`attendance/`, `leave/`, …) sit beside these, as in plan §2.

## Frontend layout (`frontend/src`)

| Path | Role |
|---|---|
| `app/(auth)/` | Public pages: login, forgot password, reset password. |
| `app/(dashboard)/` | Everything behind sign-in. The layout checks the session and renders `AppShell`. |
| `components/ui/` | shadcn/ui primitives, generated, then imported from `@/lib/utils` for `cn`. |
| `components/shell/` | App shell: sidebar rail, mobile drawer, header, user menu. |
| `components/shared/` | `PageHeader`, `StatePanel` (empty, error, forbidden), `ModulePage` placeholder. |
| `components/auth/permissions.tsx` | `PermissionsProvider`, `useCan`, `<Can>`. |
| `lib/client/navigation.ts` | The single navigation config, filtered by permissions. |
| `lib/client/session.ts` | `getSession()`: `GET /auth/me` with the visitor's cookies. Null on 401; throws otherwise. |
| `lib/client/api-client.ts` | Browser calls through `/api`: CSRF token on writes, `ApiRequestError` on failure. |
| `lib/client/server-api.ts` | Server component calls to the in-process API (`lib/server/nest.ts`), forwarding cookies. |
| `components/forms/` | `TextField` and `SelectField` (label, input, error, ARIA) and `FormAlert`. |
| `app/(dashboard)/employees/` | List (filters in the URL, table and phone cards), profile with tabs, create wizard, edit page. `employee-fields.tsx` holds the field groups both forms share. |
| `lib/client/employees.ts` | Labels, date and phone formatting, list URLs, activity wording. |
| `app/(dashboard)/departments/`, `app/(dashboard)/positions/` | Department cards and detail, positions table; create and edit in dialogs. |
| `components/shared/delete-button.tsx` | Confirmed delete that stays visible but disabled, with the reason, when a rule blocks it. |
| `components/dashboard/` | Stat tiles, presence bar, department bars and the attendance trend chart (Recharts). |
| `app/(dashboard)/reports/` | Report tabs, filters in the URL (defaults: attendance this month, leave and departments this year), totals, a paginated preview and download links; exports over 50 000 rows are disabled with the reason. Status and type words come from `lib/validations` labels, shared with the exports. |
| `app/(dashboard)/audit-logs/` | The audit log: filters in the URL (action, record type, dates; person and record by clicking), and an entry page with what changed field by field. The employee Activity tab links to the record's full history. |
| `components/notifications/` | The header bell (unread count every 60 s and on focus through TanStack Query, latest six in a popover), the shared list (opening one marks it read and follows its link) and "Mark all read". |
| `components/documents/`, `app/(dashboard)/documents/` | Document list, download and delete actions, upload dialog (multipart through `apiUpload`), `/documents` with expiry views, `/documents/types`. |
| `components/shell/command-search.tsx` | Ctrl/⌘K search dialog. cmdk's own filtering is off: the API already filtered and scoped the results. |

### Charts

Chart colors are theme tokens (`--chart-1`, `--chart-2`, `--chart-context`, `--chart-grid` in
`globals.css`), checked with the dataviz palette validator against the card surface in both modes:
light `#5B4BFF` + `#0891B2`, dark `#8B7DFF` + `#1592B8`. The dark pair's tritan separation (6.9) needs
secondary encoding, which the chart has: a legend and direct labels. Every chart also has a table view.
Status colors (on time, late, not checked in) always come with an icon and a label.

## Differences from the plan

| Plan | Built | Why |
|---|---|---|
| A new `selorax-ems` repository | This repository's root | Decision D1, 2026-09-17 put it in `ems/` alongside the Team-SeloraX app; that app was retired on 2026-09-20 and the EMS moved up to the root. |
| `@nestjs/config` | A small global `ConfigModule` around `parseEnv` | Same fail-fast validation with a typed value and one less dependency. |
| Next.js `middleware` | `src/proxy.ts` | Next 16 renamed middleware to proxy. |
| MinIO in docker compose | A `local` storage driver (files under `backend/storage`, 60-second links served by `GET /files/:token`) for development and tests; `s3` for AWS S3, R2 or MinIO | Docker isn't available on the development PC and MinIO images are gone from Docker Hub. Both drivers sit behind one `DocumentStorage` interface, and the env schema refuses `local` in production. |
| `file-type` for sniffing uploads | A small reader in `documents/sniff.ts` for the four allowed formats, including the DOCX zip directory | Four formats don't need a dependency, and fewer packages matter after the 2026-09 supply-chain incident. |
| Upload streamed to storage | Held in memory up to 10 MB, then stored | The bytes are checked before anything is stored. 10 MB per request is small. |
| Manager can't open `is_sensitive` types | Private types need `employee.view_private` for that person | The same rule then covers managers (no), HR (yes) and employees (their own), and it matches that permission's description. |
| Documents step in the create form; `pending/` uploads moved on commit | After creating someone, HR adds documents from the profile's Documents tab | Every upload is its own transaction, so no orphaned files and no cleanup job. Revisit if HR asks for it. |
| `csv-stringify` and `exceljs` for exports | Our own CSV writer, and a small streaming XLSX writer on `node:zlib` (`reports/writers/xlsx.ts`); `pdfkit` for PDF as planned | `exceljs` hasn't been released since 2024 and brings a large, ageing dependency tree; CSV and a one-sheet XLSX are small, well-specified formats. The XLSX output is checked for CRCs and well-formed XML in the tests and with Python's zipfile. |
| Exports stream from a Prisma cursor | Batches of 2 000 rows by offset, in a stable order | Works with ordering by related columns (employee code), which Prisma's cursor doesn't. A 50 000-row export is 25 queries. Live memory stays under 5 MB (tested, ceiling 10 MB). |
| "HR" as the recipient of leave, new-employee and attendance notifications | Everyone whose role grants the matching permission at ALL (`leave.approve`, `employee.view`, `attendance.manage`) | Follows roles as they are edited in Roles & permissions instead of a fixed role name. |
| A notification for every attendance issue | One summary per closed working day, sent only by the run that closed it | Ten absences shouldn't be ten notifications, and re-runs or days closed before the feature existed stay quiet. |
| Channels deliver after writing | The in-app channel is the row itself; later email/SMS channels must queue (outbox) rather than send | `notify` often runs inside the caller's transaction, which can still roll back. |
| A test that fails if a mutating endpoint writes no audit row | An interceptor that checks every successful write in every e2e test (`AUDIT_STRICT`), plus a route inventory test and a catalogue test | Every existing HTTP test becomes an audit test, so coverage grows with the suite instead of depending on a separate list of requests. |
| Audit history in the demo seed | Not seeded; the log fills with real use | Fabricated audit entries would look like real ones in a viewer whose purpose is trust. |
| `/notifications` in the sidebar | Reached from the bell's "See all" | Every page already shows the bell; a sidebar item would repeat it. |
| Brand `#2E4BDB`, Geist | Violet `#5B4BFF`, Plus Jakarta Sans + Geist Mono | Follows `plan-preview.html`. |
| Idempotency key on create | Unique indexes on email and employee ID, plus a disabled submit button while saving | A double submit gets a 409 naming the duplicate instead of creating a second record. Revisit for creates without a natural unique key. |
| DataTable on TanStack Table | A plain table (md+) and cards (phones), with filters, sort and page in the URL | One list so far; add TanStack Table when row selection or column controls are built. |
| DatePicker component | Native `<input type="date">` | Accessible and mobile-friendly with no extra dependency. |
| 5-step create form with a Documents step | Personal, Employment, Contact, Account, Review | Documents are added from the profile instead (see below). |
| Dashboard "Absent today" and department donut (preview) | "Not checked in" and a horizontal bar list | Absence is only settled after the day ends (assumption 3). Comparing department sizes is a bar's job. |
| Attendance and leave demo data in Phases 6–8 | Seeded in Phase 5 (`prisma/demo-activity.ts`) | The dashboard needs real numbers to be checked against SQL. It uses the D6 defaults; Phases 6–7 build the flows. |
| Nightly close at 23:55 (`@nestjs/schedule` cron) | A 10-minute interval plus a run at start-up that closes every closable day of the last week | The time zone is a setting, so a fixed cron time could be wrong; the interval also catches up days missed while the server was down. Closing is idempotent. |
| Absence and missing check-out notifications | Counted and logged when a day closes | Notifications arrive in Phase 9 and will hook in here. |
| Yearly allocation job on 1 January | Missing balances created at start-up and every hour, and by `POST /leave/balances/allocate` | The same idempotent step covers a new year, a new paid leave type and a reactivated employee, and catches up after downtime. |
| `SELECT … FOR UPDATE` on the balance row when submitting leave | A per-employee advisory lock (`pg_advisory_xact_lock`) around the checks and the balance change | The overlap check has to be serialized too, and it reads requests, not the balance. The CHECK constraint stays as the last line of defence. |
| Leave requests of any length | One calendar year per request | Balances are yearly, so a request that crosses 31 December is split by the requester. |
| Leave notifications (requested, approved, rejected) | Audited only | Notifications arrive in Phase 9 and will hook in here. |
| Dashboard cache cleared on relevant writes | Cleared by `AuditService.record` on every non-sign-in change | One place covers every module, including later ones. A read racing an uncommitted transaction could cache old numbers, so the cache is cleared again 2 s later. |

## Dependencies

After the September 2026 supply-chain incident, dependencies are handled conservatively:

- **`.yarnrc.yml`**: `npmMinimalAgeGate: "1w"` (a version must be public for a week),
  `enableScripts: false` (no install scripts), `defaultSemverRangePrefix: ""` (exact versions).
  `yarn.lock` pins every version, and the Yarn release itself is pinned in `.yarn/releases`, so CI,
  the images and every machine run the same one. CI uses `yarn install --immutable` (which refuses to
  change the lockfile, as `npm ci` did) and `yarn npm audit --severity high`. `.npmrc` keeps the
  equivalent npm settings as a safety net for anyone who runs npm here by mistake.
- **Peer dependencies are declared, not inherited.** npm used to hoist a package's unmet peers into
  the tree by accident; Yarn does not. `vite` (peer of `vitest` and `@vitejs/plugin-react`),
  `react-is` (peer of `recharts`) and `playwright-core` (peer of `@axe-core/playwright`) are
  therefore direct devDependencies of the workspaces that need them. Without them the frontend and
  contracts test suites fail to start.
- **Majors chosen on purpose** (2026-09-17): NestJS 11 (12 was two days old and `nestjs-zod` supports only
  10–11), Prisma 7.10.0 (npm's `latest` tag pointed at an 8.0 release candidate), TypeScript 6.0.3 (7 is
  the new native compiler; Nest depends on decorator metadata), Next 16.3.4 (16.3.5 was under a week old).
- **Added later, checked by hand** (2026-09-19): `@aws-sdk/client-s3` and `s3-request-presigner` 3.1131.0 (documents,
  production storage) and `pdfkit` 0.20.2 (PDF reports). After installing, the new packages were scanned for the
  PolinRider payload pattern and install scripts. `pdfkit` ships a bundled Yarn (`.yarn/releases/yarn-4.16.0.cjs`)
  that is byte-identical to the official `@yarnpkg/cli-dist` 4.16.0 and is never loaded.
- **Resolutions** in `package.json` patch high-severity advisories in transitive dependencies without
  changing majors: `multer` 2.3.0 (used by Nest's Express adapter), `deepmerge-ts` 8.0.2 and `mysql2` 3.24.4
  (inside the Prisma CLI). They were npm `overrides` until the move to Yarn; `resolutions` is Yarn's
  equivalent. Remove each one once the parent package ships the fix.
- **`cn`**: newer shadcn CLIs import an npm package called `cn`. It is published by shadcn, but the name
  changed owner in September 2026, so the components import `@/lib/utils` (clsx + tailwind-merge) instead.
  After `npx shadcn add`, replace `from "cn"` and uninstall it.
- **`scripts/check-payload.mjs`** runs first in CI, before `yarn install --immutable`, and fails on code hidden after a long
  run of spaces, the PolinRider pattern.

## Known traps

- **Prisma 7.10 can exit 0 without doing anything.** When no datasource URL is configured, the schema
  engine fails and the CLI swallows the error. `prisma.config.ts` always supplies a URL (a harmless
  placeholder when unset), and the CI drift step also requires the "No difference detected." output.
- **Prisma 7 doesn't read `.env`.** `prisma.config.ts` and `main.ts` load the repository's `.env` explicitly when it exists.
