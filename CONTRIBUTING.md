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
app/                 pages: (auth)/ sign-in, (dashboard)/ everything behind it
  api/v1/            one route.ts per endpoint, generated from the controllers (yarn api:routes)
components/          React components: ui/ (shadcn/ui), layout/ (shell, sidebar, menus), employee/ (team
                     profile cards, QR), shared/, and one folder per feature
hooks/               React hooks (useBrowser, useUrlSearch, useUnsavedChanges)
lib/
  validations/       zod schemas, enums, PERMISSIONS and API types, shared by both sides
  auth/              sessions, CSRF, permissions, passwords; session.ts and constants.ts for pages
  services/          API modules: controllers and services per feature (employees, organization, …)
  server/            the NestJS app, started inside Next.js on a private loopback port
  http/              errors, request context, logging
  db/                Prisma client (generated/ is built by yarn db:generate)
  qr/                QR code generation
  utils/             cn.ts (class names), format.ts
  client/            frontend helpers: the API client, server-side API calls, per-feature formatting
types/               API types by area (employee, auth, department, api), re-exported from lib/validations
config/              env.ts (environment validation), navigation.ts
prisma/              schema, migrations and demo seed
public/              static files: images/, icons/, logos/
tests/               unit/ (mirrors the source tree), integration/ (API), e2e/ (Playwright), setup/
docs/                plan, architecture, API, security, database, deployment
scripts/             repository tooling: the payload check, Postgres init SQL
```

Commands run from the repository root (`yarn dev`, `yarn test`). Pages and components never import
the API modules; anything both sides need goes in `lib/validations`, which has no runtime dependency
beyond zod.

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

After editing `prisma/schema.prisma`, run `yarn db:migrate` and commit the generated
migration. `yarn db:drift` fails when the schema has changes with no
migration, and so does CI.

## Conventions worth knowing before you write code

- **The frontend hides; the backend enforces.** Permission checks in the UI are presentation only.
  Every rule has to exist server-side, with a test that proves it — see `docs/security.md`.
- **Configuration is validated at startup** through `config/env.ts`. Never read
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
