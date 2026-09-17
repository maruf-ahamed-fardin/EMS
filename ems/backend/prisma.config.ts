import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself. Load it when present, as `nest start` does through
// ConfigModule. CI and containers set real environment variables instead.
try {
  process.loadEnvFile('../.env');
} catch {
  // No .env file: rely on the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Commands that never connect (generate, validate) still need a URL, or Prisma 7.10 skips the
    // schema engine silently and exits 0. The placeholder points nowhere and has no credentials.
    url: process.env.DATABASE_URL ?? 'postgresql://unset@127.0.0.1:1/unset',
  },
});
