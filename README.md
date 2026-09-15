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
| `tests` | Vitest unit tests |

## Getting started

Copy `.env.example` to `.env.local` and fill it in. The `MYSQL_*` variables are the HR database the site reads today. `DATABASE_URL` is the app's own database, which is optional until the new backend features are switched on.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (includes type checking)
npm run lint
npm test
```

## Deployment

Deployed on Vercel. `vercel.json` pins the framework preset to Next.js. Set the variables from `.env.example` in the Vercel project settings.

The app can also run in Docker: `docker build -t teamprofile .`, then run the image with the same variables. It listens on port 3000.

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) lints, tests and builds the app on every pull request and on every push to `main`.
