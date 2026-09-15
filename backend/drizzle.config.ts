import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';
import { connectionFields } from './src/server/db/connection';

// drizzle-kit doesn't read .env files; share the one Next.js uses
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  dialect: 'mysql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: connectionFields({
    url: process.env.DATABASE_URL ?? 'mysql://localhost/selorax_team',
    tls: process.env.DATABASE_TLS === 'off' ? 'off' : 'verify',
    caFile: process.env.DATABASE_CA_FILE || undefined,
  }),
  strict: true,
  verbose: true,
});
