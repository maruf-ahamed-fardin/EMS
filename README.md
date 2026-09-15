# Team-SeloraX

Public profile cards for SeloraX team members: look someone up by username or employee ID and get their photo, role, contact details and social links on a mobile-friendly card.

Built with Next.js (App Router), React, TypeScript and Tailwind CSS. Team data is read from the SeloraX MySQL database (`kv_store` table: `sharedUsers`, `profilePics`, `sharedProfiles`); only public fields are ever sent to the browser.

## Routes

| Path | What it shows |
| --- | --- |
| `/` | Search by username or employee ID |
| `/<username>` | Profile card. An employee ID (e.g. `/SX-001`) redirects to the username URL |
| `/api/team-profile?id=<username or employeeId>` | Same data as JSON |

Profiles are server-rendered and cached with ISR: the first visit renders the page, later visits get the cached copy, and it refreshes in the background at most every 30 seconds.

## Getting started

Create `.env.local` with the database connection:

```bash
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=selorax
```

Then:

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (includes type checking)
npm run lint
```

## Deployment

Deployed on Vercel. `vercel.json` pins the framework preset to Next.js; set the `MYSQL_*` variables in the Vercel project settings.
