# SeloraX EMS

The SeloraX employee management system: employees, departments, attendance, leave, documents,
notifications, reports and audit. It is one Next.js 16 app (React 19, Tailwind 4, shadcn/ui) with the API built in: NestJS 11 modules,
Prisma 7 and PostgreSQL 16, served at `/api/v1` by the same server. One `package.json`, one deploy.

Pages never import API modules (`lib/server`, `lib/services`, `lib/auth`, `lib/http`); they call
`/api/v1` like any client. Anything both sides need lives in `lib/validations`.

```
app/                 pages (app/(auth), app/(dashboard)) and app/api/[...path]/route.ts, the API entry
components/          React components (ui/ is shadcn/ui)
hooks/               React hooks
lib/
  client/            frontend helpers: the API client, server-side API calls, formatting
  validations/       zod schemas, enums, PERMISSIONS and API types, shared by both sides
  server/            the NestJS app, started inside Next.js on a private loopback port
  services/          API modules: controllers and services per feature
  auth/              sessions, CSRF, permissions, passwords
  http/              errors, request context, logging
  db/                Prisma client (generated/ is built by yarn db:generate)
config/              environment validation
prisma/              schema, migrations and demo seed
tests/               integration/ (API, Jest), e2e/ (Playwright), setup/ (Vitest)
docs/                plan, architecture, API, security, database, deployment
scripts/             repository tooling: the payload check, Postgres init SQL
```

Start with [`docs/plan.md`](docs/plan.md). It is the source of truth for scope, the order of work and
the decisions taken. Progress per phase is in [`docs/requirements.md`](docs/requirements.md).
[`CONTRIBUTING.md`](CONTRIBUTING.md) covers the workflow and what to run before a pull request;
[`SECURITY.md`](SECURITY.md) covers reporting a vulnerability.

| Document | What it covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | How it is built, and where and why it differs from the plan |
| [`docs/api.md`](docs/api.md) | Every endpoint, its permission and its rules |
| [`docs/security.md`](docs/security.md) | Every security control, where it lives and which test proves it |
| [`docs/performance.md`](docs/performance.md) | The query review at production volume |
| [`docs/deployment.md`](docs/deployment.md) | Images, configuration, a deploy, the first admin, backups and restore |

## Run it locally

Needs Node 22.12+ and Docker Desktop. Yarn 4 is pinned in `.yarn/releases`, so there is nothing to
install globally — `yarn` in this repository is that release.

```sh
cp .env.example .env    # local-only values that match docker-compose.yml; set SEED_PASSWORD
docker compose up -d    # Postgres on 127.0.0.1:5433, Mailpit on 127.0.0.1:8025
yarn install            # --immutable in CI and the images: refuses to change yarn.lock
yarn db:generate        # Prisma client
yarn db:deploy          # apply migrations
yarn db:seed            # permissions, roles and four demo accounts
yarn dev                # contracts watcher, API on :4000, web on :3000
```

Open http://localhost:3000 and sign in with one of the demo accounts and your `SEED_PASSWORD`:

| Role | Email |
|---|---|
| Super Admin | `superadmin@demo.selorax.test` |
| HR / Admin | `hr@demo.selorax.test` |
| Manager | `manager@demo.selorax.test` |
| Employee | `employee@demo.selorax.test` (reports to the manager) |

Password reset emails are printed in the API log (`MAIL_DRIVER=console`). To see them as real email,
set `MAIL_DRIVER=smtp` and `SMTP_URL=smtp://127.0.0.1:1025` and open Mailpit at http://127.0.0.1:8025.

## Commands (from the repository root)

| Command | Does |
|---|---|
| `yarn dev` | Everything in watch mode |
| `yarn typecheck` / `lint` / `test` / `build` | Across all three workspaces |
| `yarn db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `yarn db:deploy` | Apply migrations (the release step in production, never at app start) |
| `yarn catalogue:sync` | Align permissions and system roles with this build (release step, after `db:deploy`) |
| `yarn db:seed` | Development demo data. Refuses production. |
| `yarn db:drift` | Fails when the schema has changes with no migration |
| `yarn check:payload` | Looks for code hidden after long runs of spaces (the September 2026 incident) |
| `yarn install --immutable` | Install without letting `yarn.lock` change, as CI does |

Backend tests that need a database run when `TEST_DATABASE_URL` is set, and they wipe that database.
The compose file creates `ems_test` for this.

## Rules that keep it safe

- **No real credentials or HR data** in this workspace until the September 2026 password and token
  rotation is confirmed (plan D8). Everything is built on seed data.
- **Installs are age-gated.** `.npmrc` refuses package versions younger than 7 days and never runs
  install scripts. Don't override it to get a newer version faster.
- **Configuration is validated at startup.** The backend reads every variable through
  `config/env.ts`, and its errors name the variable, never the value.
- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.

More detail: [architecture](docs/architecture.md) · [database](docs/database.md) · [API](docs/api.md) ·
[permissions](docs/permissions.md) · [requirements](docs/requirements.md)
