# Deployment

How to run the EMS in production (plan D5, §12). Nothing here has been deployed yet; the images are built and
checked by CI on every change (`.github/workflows/ems.yml`, job `images`).

## What runs

| Piece | Image | Notes |
|---|---|---|
| API | `backend/Dockerfile`, target `runtime` | `node dist/main.js` on port 4000 as user `node`. Health: `GET /api/v1/health` (process up), `GET /api/v1/health/ready` (database reachable). |
| Release step | `backend/Dockerfile`, target `migrate` | `prisma migrate deploy`, then catalogue sync (permissions and system roles). Run once per deploy, **before** the new API starts. Never at API start-up. |
| Web | `frontend/Dockerfile` | Next.js standalone server on port 3000 as user `node`. Forwards `/api/*` to `API_ORIGIN`, which is baked in at build time (`--build-arg API_ORIGIN=http://api:4000`). |
| Database | Managed PostgreSQL 16 | Neon, Supabase, RDS or similar, with TLS and point-in-time recovery. |
| Files | S3-compatible private bucket | AWS S3 or Cloudflare R2, versioning on, public access blocked. |
| Email | SMTP | Password links and invitations. |

Build from `ems/`:

```bash
docker build -f backend/Dockerfile --target runtime -t ems-api .
docker build -f backend/Dockerfile --target migrate -t ems-migrate .
docker build -f frontend/Dockerfile --build-arg API_ORIGIN=http://api:4000 -t ems-web .
```

Only the web server faces the internet, behind a TLS-terminating proxy or load balancer. The API is reached through
the web server's `/api` rewrite, so it can stay on the private network; the browser never talks to it directly and
CORS stays closed.

## Configuration

The API refuses to start with an unsafe production configuration (`backend/src/config/env.ts`). It needs:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://…?sslmode=verify-full` (or `require`). `DATABASE_ALLOW_INSECURE=true` only on a private network. |
| `APP_URL` | The public https URL of the web app. Used for the CSRF origin check, links in emails and Secure cookies. |
| `TRUST_PROXY_HOPS` | Proxies in front of the API: usually 2 (load balancer, then the web server). Rate limits and audit IPs depend on it. |
| `MAIL_DRIVER`, `SMTP_URL`, `MAIL_FROM` | `smtp`, `smtps://user:pass@host:465`, a sender on your domain |
| `STORAGE_DRIVER`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `s3` and the bucket's settings. Leave the keys empty to use the platform's role. |
| `JOBS_ENABLED` | `true` on **exactly one** API instance (closing attendance days, leave balances, document reminders); `false` elsewhere. The jobs are idempotent, so a second one wastes work but does no harm. |
| `LOG_LEVEL` | `info` |

The web server needs only `API_ORIGIN` at build time. Secrets go in the platform's secret store, never in images or
the repository. `.env.example` lists every variable with placeholders.

## A deploy

1. CI is green on the commit (types, lint, all tests against PostgreSQL, migration drift, the browser smoke with
   axe at 375 and 1280 px, image builds).
2. Build and push the three images, tagged with the commit.
3. Run `ems-migrate` once with the production environment. Migrations are forward-only; take a database snapshot
   first if a migration drops or rewrites data.
4. Roll out `ems-api`, then `ems-web`. Health checks: `/api/v1/health/ready` for the API, `/login` for the web.
5. The first deploy only: create the first Super Admin (see below). Afterwards all accounts are made in **Users**.

### The first Super Admin

There is no default account. Once, after the first release step, with the production environment:

```bash
docker run --rm --env-file prod.env ems-api node dist/users/create-admin-cli.js admin@example.com
```

It creates a Super Admin with a password nobody knows, records it in the audit log, and refuses to run if a Super
Admin already exists. The person then sets their password with **Forgot password?** on the sign-in page and adds
everyone else in **Users**. The demo seed (`npm run db:seed`) refuses production.

## Scaling

- One API instance is enough for the expected size. For more: switch the rate limiter to the Redis store (the
  in-memory counters are per instance), keep `JOBS_ENABLED` on one of them, and expect role changes to reach the
  others within 60 seconds (permission cache).
- The web server is stateless and scales freely.

## Backups and restore

- **Database:** the managed provider's point-in-time recovery, at least 7 days (30 recommended), plus a daily
  logical dump (`pg_dump --format=custom`) kept in a different account or region for 30 days.
- **Files:** bucket versioning on, with a lifecycle rule that keeps old versions for 30 days. Documents are only
  ever soft-deleted in the app, so the file for every document row stays in the bucket.
- **What a restore needs:** the database and the bucket from the same point in time, and the same `S3_BUCKET`.
  Storage keys never change, so rows and files match again.
- **Rehearse it:** restore last night's dump into a scratch database every quarter, run the API against it with
  `JOBS_ENABLED=false`, and check a few profiles, documents and a report. Record the date in this file.
- Audit logs are part of the database backup; they are append-only and never cleaned up by the app.

| Restore rehearsed | By | Result |
|---|---|---|
| – | – | Not yet (nothing deployed) |

## Before the first real data

The development PC was compromised in September 2026 (see `docs/security.md`). Before any real employee data or
credentials are used: rotate every credential from a clean device, create production secrets only in the
hosting platform, and deploy from CI rather than from that PC.
