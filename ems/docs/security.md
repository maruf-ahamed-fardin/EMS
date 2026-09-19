# Security

The security review of Phase 12 (2026-09-19): each control, where it lives, and what proves it. Re-check this
page when adding a module.

## Controls

| Area | Control | Where | Proven by |
|---|---|---|---|
| Sessions | Opaque cookie, httpOnly, SameSite=Lax, Secure over https; only its sha256 is stored; 8 h idle, 7 days max; revocable | `auth/sessions.service.ts`, `auth/cookies.ts` | `auth.e2e-spec.ts` |
| Passwords | argon2id; length and common-password checks; lockout after 10 failures; reset links single-use, hashed, 30 min (invites 3 days); every change signs out other sessions | `auth/` | `auth.e2e-spec.ts`, `auth/security.spec.ts` |
| CSRF | `Sec-Fetch-Site` and `Origin` checks plus a double-submit token on every write | `auth/guards/csrf.guard.ts` | `auth.e2e-spec.ts` |
| Authorization | Permission guard on every route (deny unless `@Public`), scope turned into query filters, out of scope is 404 not 403 | `auth/guards/permission.guard.ts`, `auth/scope.service.ts` | `authorization-matrix.e2e-spec.ts` and every module suite |
| Lockout of admins | Nobody changes their own role or deactivates themselves; the last active Super Admin stays; Super Admin's grants can't be edited | `users/users.service.ts`, `roles/roles.controller.ts` | `users-roles.e2e-spec.ts` |
| Private data | Explicit Prisma `select`s; private employee fields need `employee.view_private`; private document types too; the audit viewer hides private values; reports carry no private fields | services, `audit/audit-log.service.ts` | `employees`, `documents`, `audit-log`, `reports` suites |
| Audit | Every successful write records an audit row in its transaction or declares why not; tests fail otherwise | `audit/audit-coverage.ts` | `audit-coverage.e2e-spec.ts` and strict mode in every suite |
| Uploads | 10 MB cap (early 413), type read from the bytes (PDF, PNG, JPEG, DOCX without macros), server-made storage keys, private bucket, 60-second links with `attachment` and a sandbox CSP | `documents/` | `documents.spec.ts`, `documents.e2e-spec.ts` |
| Exports | Scoped like the screens; 50 000-row cap; CSV cells that start with `= + - @` are neutralized; audited | `reports/` | `reports.e2e-spec.ts`, `writers.spec.ts` |
| Rate limits | 300/min per session or IP; login 5/min; forgot 3/h; reset and change 10/h | `auth/guards/throttler.guard.ts` | `auth.e2e-spec.ts` |
| Headers (web) | Per-request nonce CSP (scripts: nonce and `strict-dynamic` only), `frame-ancestors 'none'`, HSTS in production, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP | `frontend/src/proxy.ts`, `lib/csp.ts`, `next.config.ts` | `csp.test.ts`; nonce on every script checked on a live page |
| Headers (API) | helmet; CORS closed unless `CORS_ORIGINS`; 1 MB JSON limit; `no-store` on every response | `configure-app.ts`, `common/request-context.ts` | `app.e2e-spec.ts` |
| Redirects | `?next=` accepts only same-site paths | `frontend/src/lib/auth-paths.ts` | `auth-paths.test.ts` |
| Logs | JSON with request id; cookies, tokens, hashes, storage keys and `DATABASE_URL` redacted; download tokens and `token=` values masked in URLs; config errors never print values | `common/logging/`, `config/env.ts` | `logger.options.spec.ts`, `env.spec.ts` |
| Configuration | Validated at start; production refuses console mail, local storage, http `APP_URL` and a database without TLS | `config/env.ts` | `env.spec.ts` |
| SQL | Prisma queries; the few raw statements are tagged templates (parameterized); no `*Unsafe` calls | `grep RawUnsafe src` finds only generated code | review |
| Accessibility | WCAG 2 A/AA: labels on every input, visible focus, AA contrast, scrollable tables reachable by keyboard, status as icon and text | `frontend/src/components/` | axe in `e2e/smoke.spec.ts` on every page the smoke visits, at 375 and 1280 px, with no serious or critical findings; runs in CI on every change |
| Supply chain | `min-release-age=7`, `ignore-scripts`, exact versions, `npm audit` in CI, new packages scanned for the PolinRider pattern, fewer packages where a small module does the job (file sniffing, CSV, XLSX) | `.npmrc`, `architecture.md` | CI, review |

## Found and fixed in this review

- Download links were written to the request log with their token (valid for 60 seconds). URLs are now masked.
- Allocating a year's leave balances wasn't audited (Phase 11).
- Uploads over 10 MB through the Next.js proxy ended in a 500 instead of 413 (Phase 8).
- Every user received the organization-wide number of documents per type, such as how many national IDs are on file (Phase 8).

## Known limits

- Styles allow `'unsafe-inline'` because component libraries set `style` attributes; scripts don't.
- Rate limits and the permission cache are per instance. Several API instances need the Redis throttler store,
  and a permission change reaches other instances within 60 seconds.
- In PDF exports, non-Latin text (Bangla names) shows as `?`; CSV and XLSX keep it.
- Notifications are in-app only. Email or SMS channels must queue messages (an outbox), not send inside a
  transaction.
- The development PC was compromised in September 2026 (see the repository's incident notes). Nothing in this
  repository holds real credentials or data, and none may be added until credentials are rotated from a clean
  device.
