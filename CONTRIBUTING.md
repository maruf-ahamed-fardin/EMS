# Contributing

## Get set up

Node 22.12 or newer (`.nvmrc` pins it; `nvm use` picks it up) and a PostgreSQL 16 you can wipe.
`README.md` has the sequence — copy `.env.example` to `.env`, start Postgres, `npm ci`, generate the
Prisma client, apply migrations, seed, `npm run dev`.

`npm ci`, never `npm install`, unless you are deliberately changing a dependency. `.npmrc` refuses
packages published less than seven days ago and never runs install scripts; both are supply-chain
guards from the September 2026 incident, so don't switch them off to get a newer version sooner.

## The shape of the repository

```
apps/api/            NestJS API at /api/v1, Prisma, PostgreSQL
apps/web/            Next.js web app
packages/contracts/  enums, permissions, default roles and API types both sides import
docs/                architecture, API, security, database, permissions, deployment, plan
scripts/             repository tooling (the hidden-payload check, Postgres init SQL)
```

Both apps are npm workspaces named `@ems/backend` and `@ems/frontend`; the folders are `apps/api`
and `apps/web`. Run anything for one of them with `-w`, from the repository root:

```sh
npm run test -w @ems/backend
npm run dev  -w @ems/frontend
```

Nothing in `apps/web` may import from `apps/api`. Anything both sides need goes in
`packages/contracts`, which has no runtime dependency beyond zod.

## Before you open a pull request

```sh
npm run check:payload   # code hidden after long runs of spaces (the September 2026 incident)
npm run typecheck
npm run lint
npm test
```

CI runs exactly these, in this order, and `check:payload` runs before anything is installed. Tests
that need a database are skipped unless `TEST_DATABASE_URL` is set; that database is **wiped**, so
its name must contain `test`.

After editing `apps/api/prisma/schema.prisma`, run `npm run db:migrate` and commit the generated
migration. `npm run db:drift -w @ems/backend` fails when the schema has changes with no migration,
and so does CI.

## Conventions worth knowing before you write code

- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.
  Every rule has to exist server-side, with a test that proves it — see `docs/security.md`.
- **Configuration is validated at startup** through `apps/api/src/config/env.ts`. Never read
  `process.env` directly, and keep errors naming the variable, never its value: connection URLs
  carry passwords.
- **Every write is audited.** A write that lands without an audit entry logs a warning in tests;
  treat it as a failure, not noise.
- **No real credentials or HR data** in this repository until the September 2026 password and token
  rotation is confirmed (plan D8). Everything is built on seed data.

## Commits and branches

Work on a branch off `main`. Commit messages use the `type: summary` form already in the history —
`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:` — with a body explaining *why* when the
reason is not obvious from the diff. Keep a commit to one coherent change; a restructure and a
behaviour change belong in separate commits.
