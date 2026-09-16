# Team-SeloraX

Public profile cards for SeloraX team members. One Next.js app (App Router, React, TypeScript,
Tailwind v4) serves the pages and the API. See `README.md` for setup and commands.

## The one thing to know first

There are **two data paths**, and only the first is live:

1. **Live:** pages and `/api/team-profile` read the HR app's `kv_store` table through
   `src/lib/team.ts`. This is what users hit today.
2. **Not yet connected:** `src/server/**` and `drizzle/` describe this app's own database
   (`members`, `member_profiles`, `member_avatars`, `username_aliases`, `sync_runs`).
   **Nothing in the app reads these tables yet.** The kv_store sync can plan changes
   (`src/server/modules/sync/plan.ts`) but cannot apply them, and there is no auth, no write
   API and no avatar upload, although the schema and `usernames.ts` reserved list anticipate all three.

When changing profile behaviour that users see, change path 1. Don't assume path 2 is wired up.

## Conventions

- **Environment:** every variable goes through the zod schema in `src/server/env.ts`. Never read
  `process.env` directly for configuration. The exception is `src/lib/site.ts`, which `next build`
  imports before runtime config exists, and `logger.ts`, which must work when the config is broken.
- **Secrets in errors:** connection URLs carry passwords. `parseEnv` reports which variable is
  wrong, never its value, and `logger.ts` redacts known secret paths. Keep it that way.
- **API routes** wrap their handler in `route()` from `src/server/lib/http.ts`. It supplies the
  request id, a bound logger, `private, no-store` by default, and turns thrown errors into
  RFC 9457 `problem+json`. Don't use `console.error` in a route.
- **Public fields are an allow-list.** `PUBLIC_USER_FIELDS` in `src/lib/team.ts` is the only thing
  keeping passwords, salaries and addresses out of public responses, because `kv_store` rows hold
  all of them. Tests in `tests/unit/team.test.ts` guard this — extend them when the shape changes.
- **Database:** MySQL 8 via Drizzle. Text columns rely on the `utf8mb4_0900_ai_ci` default
  collation, which is what makes usernames case-insensitively unique. After editing
  `src/server/db/schema`, run `npm run db:generate`; CI fails if the migration is missing.
- **TLS:** every MySQL connection goes through `sslOptions` in `src/server/db/connection.ts`.
  Certificate verification is required in production.
- **`src/server/db/schema` and `connection.ts` use relative imports**, not the `@/` alias, because
  drizzle-kit and the scripts load them outside the Next.js bundler.

## Testing

`npm test` runs Vitest. Database tests in `tests/integration` skip unless `TEST_DATABASE_URL` is
set; they drop and recreate the database, so the name must contain "test". `docker compose up -d`
provides a suitable server on port 3307. `server-only` is aliased to a stub in `vitest.config.mts`
because Next resolves it through its bundler rather than installing it.
