import { readFileSync } from 'node:fs';
import type { ConnectionOptions, PoolOptions } from 'mysql2';

// Relative imports only: drizzle.config.ts and scripts load this without the `@/` alias

export interface DbConfig {
  url: string;
  tls: 'verify' | 'off';
  caFile?: string;
}

// Kept to fields that fit both mysql2's SslOptions and drizzle-kit's narrower copy of it
type Ssl = { rejectUnauthorized: boolean; ca?: string } | undefined;

function sslOptions({ tls, caFile }: DbConfig): Ssl {
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
  const password = decodeURIComponent(url.password);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    // drizzle-kit rejects an empty password, so leave it out for passwordless local servers
    ...(password && { password }),
    database: url.pathname.slice(1),
    ssl: sslOptions(config),
  };
}
