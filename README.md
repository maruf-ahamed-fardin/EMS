# Team-SeloraX

Public profile cards for SeloraX team members: look someone up by username or employee ID and get their photo, role, contact details and social links on a mobile-friendly card.

## Repository layout

| Folder | What it is |
| --- | --- |
| `frontend/` | The public site: Next.js (App Router), React, TypeScript and Tailwind CSS |

Each app is self-contained, with its own `package.json`, lockfile and TypeScript config. Run npm commands inside the app's folder.

## Frontend

Team data is read from the SeloraX MySQL database (`kv_store` table: `sharedUsers`, `profilePics`, `sharedProfiles`). Only public fields are ever sent to the browser.

### Routes

| Path | What it shows |
| --- | --- |
| `/` | Search by username or employee ID |
| `/<username>` | Profile card. An employee ID (e.g. `/SX-001`) redirects to the username URL |
| `/api/team-profile?id=<username or employeeId>` | Same data as JSON |

Profiles are server-rendered and cached with ISR. The first visit renders the page and later visits get the cached copy. The cache refreshes in the background at most every 30 seconds.

### Getting started

Create `frontend/.env.local` with the database connection:

```bash
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=selorax
```

Then:

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (includes type checking)
npm run lint
```

### Deployment

Deployed on Vercel. In the Vercel project settings, set the **Root Directory** to `frontend` and add the `MYSQL_*` variables. `frontend/vercel.json` pins the framework preset to Next.js.

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) lints and builds each app on every pull request and on every push to `main`.
