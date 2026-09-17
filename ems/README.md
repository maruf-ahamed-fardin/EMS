# SeloraX EMS

The SeloraX employee management system: employees, departments, attendance, leave, documents,
notifications, reports and audit. It is a separate npm workspace inside the Team-SeloraX repository and
shares nothing with the app at the repository root.

| Workspace | What | Stack |
|---|---|---|
| `packages/contracts` | Enums, the permission catalogue, default roles and API shapes shared by both sides | TypeScript + zod |
| `backend` | The API at `/api/v1` | NestJS 11, Prisma 7, PostgreSQL 16 |
| `frontend` | The web app | Next.js 16, React 19, Tailwind 4, shadcn/ui |

Start with [`docs/plan.md`](docs/plan.md). It is the source of truth for scope, the order of work and
the decisions taken. Build status: **Phase 1 (architecture) is done.** Everything else is still to come.

## Run it locally

Needs Node 22.12+ and Docker Desktop.

```sh
cd ems
cp .env.example .env         # local-only values that match docker-compose.yml
docker compose up -d         # Postgres on 127.0.0.1:5433, Mailpit on 127.0.0.1:8025
npm ci
npm run db:generate          # Prisma client
npm run db:deploy            # apply migrations
npm run dev                  # contracts watcher, API on :4000, web on :3000
```

Open http://localhost:3000. Sign-in is built in Phase 2. Until then, in development only, the login
page has **Development preview** buttons that open the app as each default role, so the navigation and
access rules can be checked.

## Commands (from `ems/`)

| Command | Does |
|---|---|
| `npm run dev` | Everything in watch mode |
| `npm run typecheck` / `lint` / `test` / `build` | Across all three workspaces |
| `npm run db:migrate` | Create a migration after editing `backend/prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations (the release step in production, never at app start) |
| `npm run db:drift -w @ems/backend` | Fails when the schema has changes with no migration |
| `npm run check:payload` | Looks for code hidden after long runs of spaces (the September 2026 incident) |

Backend tests that need a database run when `TEST_DATABASE_URL` is set, and they wipe that database.
The compose file creates `ems_test` for this.

## Rules that keep it safe

- **No real credentials or HR data** in this workspace until the September 2026 password and token
  rotation is confirmed (plan D8). Everything is built on seed data.
- **Installs are age-gated.** `.npmrc` refuses package versions younger than 7 days and never runs
  install scripts. Don't override it to get a newer version faster.
- **Configuration is validated at startup.** The backend reads every variable through
  `backend/src/config/env.ts`, and its errors name the variable, never the value.
- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.

More detail: [architecture](docs/architecture.md) · [database](docs/database.md) · [API](docs/api.md) ·
[permissions](docs/permissions.md) · [requirements](docs/requirements.md)
