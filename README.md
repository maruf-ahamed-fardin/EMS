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

Profiles are server-rendered and cached with ISR. The first visit renders the page and later visits get the cached copy. The cache refreshes in the background at most every 30 seconds.

## Project structure

| Folder | What's in it |
| --- | --- |
| `src/app`, `src/components` | Pages, API routes and UI |
| `src/lib/team.ts` | Current profile lookup, straight from `kv_store` |
| `src/server` | Backend code: environment config, database schema and client, logging, HTTP helpers, feature modules |
| `src/proxy.ts` | Request IDs, an origin check on API writes, and security headers for `/api/*` |
| `drizzle` | Database migrations, generated from `src/server/db/schema` |
| `scripts` | Command-line tasks such as the `kv_store` sync |
| `tests` | Vitest unit tests, plus database tests when `TEST_DATABASE_URL` is set |

## Getting started

Copy `.env.example` to `.env.local` and fill it in. The `MYSQL_*` variables are the HR database the site reads today. `DATABASE_URL` is the app's own database, which is optional until the new backend features are switched on.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (includes type checking)
npm run lint
npm test
```

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

To run the database tests too, point `TEST_DATABASE_URL` at a MySQL 8 server. Use a throwaway database whose name contains "test", because it's dropped and recreated on every run. For example: `TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/teamprofile_test npm test`.

## Deployment

Deployed on Vercel. `vercel.json` pins the framework preset to Next.js. Set the variables from `.env.example` in the Vercel project settings.

The app can also run in Docker: `docker build -t teamprofile .`, then run the image with the same variables. It listens on port 3000.

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) lints, tests (including the database tests, against a MySQL 8.4 service) and builds the app on every pull request and on every push to `main`.
