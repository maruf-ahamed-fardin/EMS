import { readFileSync } from 'node:fs';
import type { ConnectionOptions, PoolOptions } from 'mysql2';

// Relative imports only: drizzle.config.ts and scripts load this without the `@/` alias

export interface DbConfig {
  url: string;
  tls: 'verify' | 'off';
  caFile?: string;
}

function sslOptions({ tls, caFile }: DbConfig): ConnectionOptions['ssl'] {
  if (tls === 'off') return undefined;
  return { rejectUnauthorized: true, ...(caFile && { ca: readFileSync(caFile, 'utf8') }) };
}

/** mysql2 settings shared by the app, migrations and scripts. Dates are read and written as UTC. */
export function connectionOptions(config: DbConfig): ConnectionOptions {
  return { uri: config.url, ssl: sslOptions(config), timezone: 'Z' };
}

export function poolOptions(config: DbConfig): PoolOptions {
  return { ...connectionOptions(config), connectionLimit: 10 };
}

/** The same connection split into fields, for drizzle-kit. */
export function connectionFields(config: DbConfig) {
  const url = new URL(config.url);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: sslOptions(config),
  };
}
