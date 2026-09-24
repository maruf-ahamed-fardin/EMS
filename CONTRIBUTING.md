# Contributing

## Get set up

Node 22.12 or newer (`.nvmrc` pins it; `nvm use` picks it up) and a PostgreSQL 16 you can wipe.
`README.md` has the sequence — copy `.env.example` to `.env`, start Postgres, `yarn install`,
generate the Prisma client, apply migrations, seed, `yarn dev`.

The project is on **Yarn 4**, pinned in `.yarn/releases` and selected by the `packageManager` field,
so you need no global install: `yarn` in this repository is that release. Use
`yarn install --immutable` unless you are deliberately changing a dependency — it refuses to modify
`yarn.lock`, which is what CI and the images do.

Don't run npm here. `.yarnrc.yml` refuses packages published less than seven days ago
(`npmMinimalAgeGate`) and never runs install scripts (`enableScripts: false`); both are
supply-chain guards from the September 2026 incident, so don't switch them off to get a newer
version sooner.

## The shape of the repository

```
apps/web/            Next.js web app; serves the API at /api/*
apps/web/server/     NestJS API at /api/v1, Prisma, PostgreSQL, run inside the web app
apps/web/contracts/  enums, permissions, default roles and API types both sides import
docs/                architecture, API, security, database, permissions, deployment, plan
scripts/             repository tooling (the hidden-payload check, Postgres init SQL)
```

The API and the web app are Yarn workspaces named `@ems/backend` and `@ems/frontend`; the folders are
`apps/web/server` and `apps/web`. The name is what commands take, from the repository root:

```sh
yarn workspace @ems/backend run test
yarn workspace @ems/frontend run dev
```

The web app uses the API package in exactly one place, `apps/web/src/lib/embedded-api.ts`, which starts
it; everything else talks to it over HTTP at `/api/v1`, as a browser does, so the API's guards apply to
every call. Anything both sides need goes in
`apps/web/contracts`, which has no runtime dependency beyond zod.

## Before you open a pull request

```sh
yarn check:payload   # code hidden after long runs of spaces (the September 2026 incident)
yarn typecheck
yarn lint
yarn test
```

CI runs exactly these, in this order, and `check:payload` runs before anything is installed. Tests
that need a database are skipped unless `TEST_DATABASE_URL` is set; that database is **wiped**, so
its name must contain `test`.

After editing `apps/web/server/prisma/schema.prisma`, run `yarn db:migrate` and commit the generated
migration. `yarn workspace @ems/backend run db:drift` fails when the schema has changes with no
migration, and so does CI.

## Conventions worth knowing before you write code

- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.
  Every rule has to exist server-side, with a test that proves it — see `docs/security.md`.
- **Configuration is validated at startup** through `apps/web/server/src/config/env.ts`. Never read
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
