# Team-SeloraX

Public profile cards for SeloraX team members: look someone up by username or employee ID and get their photo, role, contact details and social links on a mobile-friendly card.

One Next.js app (App Router, React, TypeScript, Tailwind CSS) serves both the pages and the API. Team data is read from the SeloraX MySQL database (`kv_store` table: `sharedUsers`, `profilePics`, `sharedProfiles`). Only public fields are ever sent to the browser.

## Routes

| Path | What it shows |
| --- | --- |
| `/` | Search by username or employee ID |
| `/<username>` | Profile card. An employee ID (e.g. `/SX-001`) redirects to the username URL |
| `/api/team-profile?id=<username or employeeId>` | Same data as JSON |
| `/api/health` | `200` when the app's own database answers, `503` otherwise |

`/api/team-profile` is rate limited per caller (60 requests a minute) so the employee-ID range can't be walked cheaply. The counters live in each serverless instance's memory, which is enough to slow down a single scraper but is not a strict quota. Errors come back as `application/problem+json`.

Profiles are server-rendered and cached with ISR. The first visit renders the page and later visits get the cached copy. The cache refreshes in the background at most every 30 seconds.

## Project structure

| Folder | What's in it |
| --- | --- |
| `src/app`, `src/components` | Pages, API routes and UI |
| `src/lib/team.ts` | Current profile lookup, straight from `kv_store` |
| `src/server` | Backend code: environment config, database schema and client, logging, HTTP helpers, feature modules |
| `src/proxy.ts` | Request IDs, an origin check on API writes, and security headers for `/api/*` |
| `src/lib/site.ts` | Public base URL for canonical links, the sitemap and link previews |
| `drizzle` | Database migrations, generated from `src/server/db/schema` |
| `scripts` | Command-line tasks such as the `kv_store` sync |
| `tests` | Vitest unit tests, plus database tests when `TEST_DATABASE_URL` is set |

## Getting started

Copy `.env.example` to `.env.local` and fill it in. The `MYSQL_*` variables are the HR database the site reads today. `DATABASE_URL` is the app's own database, which is optional until the new backend features are switched on.

`MYSQL_HOST`, `MYSQL_USER` and `MYSQL_DATABASE` are required in production and have no fallbacks, so a half-configured deploy stops at startup instead of quietly reading the wrong server. In development they fall back to `127.0.0.1` / `root` / `selorax`, and TLS is skipped for a server on this machine, whose certificate could never verify. A development server pointed at a *remote* host still verifies, because that is when credentials would cross a network.

> **Upgrading an existing deployment:** the HR connection now verifies the server's TLS certificate, and `MYSQL_TLS=off` is refused in production. If that server uses a self-signed or private certificate, point `MYSQL_CA_FILE` at its CA before deploying, or the connection will fail.

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (includes type checking)
npm run lint
npm test
npm run test:coverage  # same tests, with a coverage summary
```

With no MySQL to hand, set `HR_DATA_FILE` to a JSON file holding the three `kv_store` keys and the site serves profiles from it instead of connecting to a database - useful for frontend work, and it needs no real credentials. `tests/fixtures/kv-sample.json` works as a starting point. The environment schema refuses it in production.

A local MySQL for development and the database tests comes from `docker compose up -d`. It listens on port 3307 and creates `selorax_team` and `teamprofile_test` with the right collation.

## Database and sync

The app's own database is MySQL 8, managed with Drizzle. Create it with `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`, because unique usernames rely on that collation ignoring letter case. Then set `DATABASE_URL` and run:

```bash
npm run db:migrate    # apply the migrations in drizzle/
npm run db:generate   # after changing the schema, write a new migration (CI fails if you forget)
```

Team members come from the HR app's `kv_store` through a one-way sync that never writes to `kv_store`. For now it only reports what it would change:

```bash
npm run sync:kv -- --dry-run                                        # read kv_store through KV_DATABASE_URL
npm run sync:kv -- --dry-run --file tests/fixtures/kv-sample.json   # or read a JSON export
```

The report lists new, renamed, updated and deactivated members, conflicts it won't apply (duplicate employee IDs, reserved usernames, clashes with manually added members) and fields it drops. It never prints contact details. If more than 20% of members would change, the circuit breaker stops the run. Check the HR data, then pass `--force` if the change is real.

To run the database tests too, point `TEST_DATABASE_URL` at a MySQL 8 server. Use a throwaway database whose name contains "test", because it's dropped and recreated on every run. With the compose file above: `TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/teamprofile_test npm test`.

## Deployment

Deployed on Vercel. `vercel.json` pins the framework preset to Next.js. Set the variables from `.env.example` in the Vercel project settings.

`SITE_URL` is needed at **build** time, not just at runtime: statically rendered pages bake their absolute URLs into the output, so link previews and canonical URLs come from whatever the build saw. Vercel supplies its own deployment URL, so nothing is needed there. Elsewhere, pass it to the build:

```bash
docker build --build-arg SITE_URL=https://team.selorax.io -t teamprofile .
```

Then run the image with the same variables from `.env.example`. It listens on port 3000. If the running server's `SITE_URL` disagrees with the one baked into the build, it says so at startup.

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) audits dependencies, checks the migrations match the schema, lints, tests (including the database tests, against a MySQL 8.4 service) and builds both the app and the Docker image, on every pull request and every push to `main`.

CodeQL (`.github/workflows/codeql.yml`) scans the code on the same events and weekly, so advisories published against code that isn't changing still surface. Dependabot opens grouped dependency updates every week.
