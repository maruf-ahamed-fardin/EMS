# Deployment

How to run the EMS in production (plan D5, §12). It is one Next.js app with the API inside it: `lib/server/nest.ts`
starts the NestJS modules on a private loopback port the first time a request needs them, and
the route files under `app/api/v1` (one per endpoint, `yarn api:routes`) forward to it. The browser only ever talks to the app, so CORS stays closed.

## What runs

| Piece | Where | Notes |
|---|---|---|
| App | Vercel (`vercel.json`), or `yarn build && yarn start` on any Node 22 host | Pages and the API at `/api/v1`. Health: `GET /api/v1/health` (process up), `GET /api/v1/health/ready` (database reachable). |
| Release step | `yarn db:deploy && yarn catalogue:sync` | Migrations, then the permission catalogue and system roles. On Vercel it is part of the build command. |
| Database | Managed PostgreSQL 16 | Neon, Supabase, RDS or similar, with TLS and point-in-time recovery. |
| Files | S3-compatible private bucket | AWS S3 or Cloudflare R2, versioning on, public access blocked. |
| Email | SMTP | Password links and invitations. |

## Configuration

The API refuses to start with an unsafe production configuration (`config/env.ts`). It needs:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://…?sslmode=verify-full` (or `require`). `DATABASE_ALLOW_INSECURE=true` only on a private network. |
| `APP_URL` | The public https URL of the web app. Used for the CSRF origin check, links in emails and Secure cookies. |
| `TRUST_PROXY_HOPS` | `1`: the route handler in front of the API. On Vercel, `x-forwarded-for` is set by the platform. Rate limits and audit IPs depend on it. |
| `MAIL_DRIVER`, `SMTP_URL`, `MAIL_FROM` | `smtp`, `smtps://user:pass@host:465`, a sender on your domain |
| `STORAGE_DRIVER`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `s3` and the bucket's settings. Leave the keys empty to use the platform's role. |
| `JOBS_ENABLED` | `true`. On a serverless host the jobs (closing attendance days, leave balances, document reminders) only run while an instance is awake; they are idempotent and catch up on the next run. |
| `LOG_LEVEL` | `info` |

Secrets go in the platform's secret store, never in images or
the repository. `.env.example` lists every variable with placeholders.

## A deploy

1. CI is green on the commit (types, lint, all tests against PostgreSQL, migration drift, the browser smoke with
   axe at 375 and 1280 px).
2. Migrations are forward-only; take a database snapshot first if one drops or rewrites data.
3. Deploy. On Vercel the build runs the release step, then `next build`. Health check: `/api/v1/health/ready`.
4. The first deploy only: create the first Super Admin (see below). Afterwards all accounts are made in **Users**.

### The first Super Admin

There is no default account. Once, after the first release step, with the production environment:

```bash
yarn tsx lib/services/users/create-admin-cli.ts admin@example.com   # with the production environment
```

It creates a Super Admin with a password nobody knows, records it in the audit log, and refuses to run while any
Super Admin can sign in. (If every Super Admin account ever ends up inactive, the same command is the way back in.) The person then sets their password with **Forgot password?** on the sign-in page and adds
everyone else in **Users**. The demo seed (`yarn db:seed`) refuses production.

## Demo on Vercel

A demo on seed data only (plan D8: no real people or credentials): one Vercel project, the database on Neon, files
in a Cloudflare R2 bucket and mail through any SMTP provider. Create these on throwaway accounts, and paste every
secret straight into Vercel:

1. **Neon:** a project in Singapore (or Vercel → Storage → Neon, which sets `DATABASE_URL` for you). Use the
   direct (not pooled) connection string, `…?sslmode=require`.
2. **R2:** a private bucket and an API token with Object Read & Write on it.
3. **SMTP:** for example Brevo's free plan, with a verified sender.
4. **Vercel:** import the repository with the Root Directory left at the root. `vercel.json` installs with the Yarn
   pinned in `.yarn/releases`, then migrates, syncs the catalogue and builds. Environment variables:
   `DATABASE_URL`, `APP_URL` (the Vercel URL, https), `MAIL_DRIVER=smtp`, `SMTP_URL`, `MAIL_FROM`,
   `STORAGE_DRIVER=s3`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
5. **Demo data, once:** from a trusted machine, `DATABASE_URL=… SEED_PASSWORD=… yarn db:seed` with the S3
   variables set, so the sample PDFs land in the bucket. The seed refuses `NODE_ENV=production`.

Vercel limits a function response to 4.5 MB, so a document larger than that cannot be downloaded there.

**Sign-in without a database.** Set `LOGIN_EMAIL` and `LOGIN_PASSWORD` (server-side, never `NEXT_PUBLIC_`) and the
login page checks that one account on the server instead of the API (`lib/client/local-auth.ts`): a signed,
`httpOnly` cookie for 12 hours, every permission, no sign-up and no password reset. Pages that load data still
need the database. Remove both variables to go back to the API's sign-in.

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
