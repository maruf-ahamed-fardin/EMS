# SeloraX EMS

The SeloraX Employee Management System, and nothing else: a NestJS + Prisma + PostgreSQL API, a
Next.js frontend and the contracts package they share, in one Yarn 4 workspace at the repository root.
See `README.md` for setup and commands, and read `docs/plan.md` before starting work — it is the
source of truth for scope, the order of work and the decisions taken.

## History you will run into

Until 2026-09-20 this repository held a second, unrelated app (Team-SeloraX profile cards: Next.js,
Drizzle, MySQL) at the root, and the EMS lived in `ems/`. That app was retired and the EMS moved up
to the root. Decision D1 in `docs/plan.md` and the differences table in `docs/architecture.md` record
this. Anything on `main` or in older commits still has the old layout, so paths there start with
`ems/` — and a `git log` on any EMS file needs `--follow` to cross the move.

| Document | What it covers |
|---|---|
| `docs/architecture.md` | How it is built, and where and why it differs from the plan |
| `docs/api.md` | Every endpoint, its permission and its rules |
| `docs/security.md` | Every security control, where it lives and which test proves it |
| `docs/database.md`, `docs/permissions.md` | Schema and the permission catalogue |
| `docs/deployment.md` | Images, configuration, a deploy, the first admin, backups and restore |

## Conventions

- **Environment:** every variable goes through `apps/api/src/config/env.ts`. It validates at startup
  and its errors name the variable, never the value.
- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.
- **No real credentials or HR data** in this repository until the September 2026 password and token
  rotation is confirmed (plan D8). Everything is built on seed data.
- **Yarn 4 only**, pinned in `.yarn/releases` — never npm. Installs are age-gated: `.yarnrc.yml`
  refuses package versions younger than 7 days (`npmMinimalAgeGate`) and never runs install scripts
  (`enableScripts: false`). Don't override either to get a newer version faster.
- **After editing `apps/api/prisma/schema.prisma`,** run `yarn db:migrate`; `yarn db:drift -w
  @ems/backend` fails when the schema has changes with no migration.
- **`yarn check:payload`** looks for code hidden after long runs of spaces (the September 2026
  incident). CI runs it before installing anything.

## Local development

No Docker on the development PC: `docker-compose.yml` is the documented path, but Postgres is run
from a portable build on `127.0.0.1:5433`. The demo accounts are `superadmin@`, `hr@`, `manager@`
and `employee@demo.selorax.test`. `yarn db:seed` sets their password from `SEED_PASSWORD`, which
`apps/api/src/auth/password-policy.ts` requires to be 10+ characters.
