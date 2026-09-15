import { z } from 'zod';

const mysqlUrl = z.url({ protocol: /^mysql$/, error: 'Must be a mysql:// URL' });

const commaList = z.string().transform(value => value.split(',').map(item => item.trim()).filter(Boolean));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /**
   * The app's own database, e.g. mysql://team_app:...@db:3306/selorax_team. Optional so the site
   * (which still reads kv_store through MYSQL_*) keeps running until this database exists.
   */
  DATABASE_URL: mysqlUrl.optional(),
  /** `verify` checks the server certificate (against DATABASE_CA_FILE when set). `off` is for local MySQL only. */
  DATABASE_TLS: z.enum(['verify', 'off']).default('verify'),
  DATABASE_CA_FILE: z.string().optional(),
  /** Read-only connection to the HR app's database, used only by the kv_store sync */
  KV_DATABASE_URL: mysqlUrl.optional(),
  /** Browser origins allowed to send state-changing requests (the public frontend), comma separated */
  ALLOWED_ORIGINS: commaList.default([]),
});

export type Env = z.infer<typeof schema>;

/**
 * Validates configuration. The error lists which variables are wrong but never their values,
 * because connection URLs carry passwords.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // An empty line in .env (`KEY=`) means "not set"
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Parsed lazily so `next build` can import route modules without runtime secrets. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
