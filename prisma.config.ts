import { defineConfig } from 'prisma/config';

import { loadRepoEnv } from './config/load-env';

// Prisma 7 no longer reads .env itself. Load it when present, as `nest start` does through
// ConfigModule. CI and containers set real environment variables instead.
loadRepoEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Development demo data only; prisma/seed.ts refuses production
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Commands that never connect (generate, validate) still need a URL, or Prisma 7.10 skips the
    // schema engine silently and exits 0. The placeholder points nowhere and has no credentials.
    url: process.env.DATABASE_URL ?? 'postgresql://unset@127.0.0.1:1/unset',
    // Scratch database for `migrate dev` and the drift check (`npm run db:drift`)
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
