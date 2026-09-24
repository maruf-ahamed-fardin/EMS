# SeloraX EMS

The SeloraX employee management system: employees, departments, attendance, leave, documents,
notifications, reports and audit. The repository is one Yarn workspace: a Next.js web app with a NestJS
API inside it, and the contracts package they share. It deploys as one app (one Vercel project).

| Folder | Workspace | What | Stack |
|---|---|---|---|
| `apps/web` | `@ems/frontend` | The web app, which serves the API at `/api/*` | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| `apps/web/server` | `@ems/backend` | The API at `/api/v1`, run inside the web app | NestJS 11, Prisma 7, PostgreSQL 16 |
| `packages/contracts` | `@ems/contracts` | Enums, the permission catalogue, default roles and API shapes shared by both sides | TypeScript + zod |

The folder and the workspace name differ, and commands take the name:
`yarn workspace @ems/backend run test`.
The web app reaches the API only through `src/lib/embedded-api.ts`, which starts it inside the same Node
process on a private loopback port; `src/app/api/[...path]/route.ts` forwards every `/api/*` request to
it unchanged. Nothing else in `apps/web/src` imports from `apps/web/server`; anything both sides need
lives in `packages/contracts`.

```
apps/
  web/      src/  test/  e2e/          the web app, its unit tests and its Playwright tests
    server/ src/  prisma/  test/       the API, its schema and migrations, its tests
packages/
  contracts/                           zod schemas, enums, PERMISSIONS, API types
docs/                                  plan, architecture, API, security, database, deployment
scripts/                               repository tooling: the payload check, Postgres init SQL
.github/workflows/                     CI
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
yarn dev                # contracts and API watchers, the app (with the API inside) on :3000
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
| `yarn db:migrate` | Create a migration after editing `apps/web/server/prisma/schema.prisma` |
| `yarn db:deploy` | Apply migrations (the release step in production, never at app start) |
| `yarn workspace @ems/backend run catalogue:sync` | Align permissions and system roles with this build (release step, after `db:deploy`) |
| `yarn db:seed` | Development demo data. Refuses production. |
| `yarn workspace @ems/backend run db:drift` | Fails when the schema has changes with no migration |
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
  `apps/web/server/src/config/env.ts`, and its errors name the variable, never the value.
- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.

More detail: [architecture](docs/architecture.md) · [database](docs/database.md) · [API](docs/api.md) ·
[permissions](docs/permissions.md) · [requirements](docs/requirements.md)
