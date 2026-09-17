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
| `common/request-context.ts` | Request id and the AsyncLocalStorage context used by logging, errors and (Phase 2+) audit. |
| `common/errors/` | The one exception filter and zod → field error mapping. |
| `common/logging/` | pino options, redaction list. |
| `prisma/` | `PrismaService`, global. |
| `health/` | `GET /health` (liveness) and `GET /health/ready` (database). |
| `generated/prisma/` | Generated client, not committed. `npm run db:generate` rebuilds it. |

Modules from later phases (`auth/`, `employees/`, …) sit beside these, as in plan §2.

## Frontend layout (`frontend/src`)

| Path | Role |
|---|---|
| `app/(auth)/` | Public pages (login; forgot and reset password in Phase 2). |
| `app/(app)/` | Everything behind sign-in. The layout checks the session and renders `AppShell`. |
| `components/ui/` | shadcn/ui primitives, generated, then imported from `@/lib/utils` for `cn`. |
| `components/shell/` | App shell: sidebar rail, mobile drawer, header, user menu. |
| `components/shared/` | `PageHeader`, `StatePanel` (empty, error, forbidden), `ModulePage` placeholder. |
| `components/auth/permissions.tsx` | `PermissionsProvider`, `useCan`, `<Can>`. |
| `lib/navigation.ts` | The single navigation config, filtered by permissions. |
| `lib/session.ts` | `getSession()`. Phase 1 uses the preview session; Phase 2 calls `/auth/me`. |
| `lib/preview-session.ts` | **Development-only, temporary.** Refused in production builds; deleted in Phase 2. |

## Differences from the plan

| Plan | Built | Why |
|---|---|---|
| A new `selorax-ems` repository | `ems/` in this repository | Decision D1, 2026-09-17. |
| `@nestjs/config` | A small global `ConfigModule` around `parseEnv` | Same fail-fast validation with a typed value and one less dependency. |
| Next.js `middleware` | `src/proxy.ts` | Next 16 renamed middleware to proxy. |
| MinIO in docker compose | Not yet | MinIO images are gone from Docker Hub. Phase 8 picks the S3-compatible image. |
| Brand `#2E4BDB`, Geist | Violet `#5B4BFF`, Plus Jakarta Sans + Geist Mono | Follows `plan-preview.html`. |

## Dependencies

After the September 2026 supply-chain incident, dependencies are handled conservatively:

- **`.npmrc`**: `min-release-age=7` (a version must be public for a week), `ignore-scripts=true` (no
  install scripts), `save-exact=true`. The lockfile pins every version. CI uses `npm ci` and
  `npm audit --audit-level=high`.
- **Majors chosen on purpose** (2026-09-17): NestJS 11 (12 was two days old and `nestjs-zod` supports only
  10–11), Prisma 7.10.0 (npm's `latest` tag pointed at an 8.0 release candidate), TypeScript 6.0.3 (7 is
  the new native compiler; Nest depends on decorator metadata), Next 16.3.4 (16.3.5 was under a week old).
- **Overrides** in `package.json` patch high-severity advisories in transitive dependencies without
  changing majors: `multer` 2.3.0 (used by Nest's Express adapter), `deepmerge-ts` 8.0.2 and `mysql2` 3.24.4
  (inside the Prisma CLI). `npm ls` reports them as "invalid"; that is expected for overrides of pinned
  versions. Remove each override once the parent package ships the fix.
- **`cn`**: newer shadcn CLIs import an npm package called `cn`. It is published by shadcn, but the name
  changed owner in September 2026, so the components import `@/lib/utils` (clsx + tailwind-merge) instead.
  After `npx shadcn add`, replace `from "cn"` and uninstall it.
- **`scripts/check-payload.mjs`** runs first in CI, before `npm ci`, and fails on code hidden after a long
  run of spaces, the PolinRider pattern.

## Known traps

- **Prisma 7.10 can exit 0 without doing anything.** When no datasource URL is configured, the schema
  engine fails and the CLI swallows the error. `prisma.config.ts` always supplies a URL (a harmless
  placeholder when unset), and the CI drift step also requires the "No difference detected." output.
- **Prisma 7 doesn't read `.env`.** `prisma.config.ts` and `main.ts` load `ems/.env` explicitly when it exists.
