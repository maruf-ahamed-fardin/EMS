import { z } from 'zod';

const mysqlUrl = z.url({ protocol: /^mysql$/, error: 'Must be a mysql:// URL' });

const commaList = z.string().transform(value => value.split(',').map(item => item.trim()).filter(Boolean));

/** `verify` checks the server certificate (against the matching CA file when set). `off` is for local MySQL only. */
const tlsMode = z.enum(['verify', 'off']).default('verify');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /**
   * The app's own database, e.g. mysql://team_app:...@db:3306/selorax_team. Optional so the site
   * (which still reads kv_store through MYSQL_*) keeps running until this database exists.
   */
  DATABASE_URL: mysqlUrl.optional(),
  DATABASE_TLS: tlsMode,
  DATABASE_CA_FILE: z.string().optional(),
  /** Read-only connection to the HR app's database, used only by the kv_store sync */
  KV_DATABASE_URL: mysqlUrl.optional(),
  /**
   * The HR app's database, read by the profile pages and /api/team-profile. Required in production:
   * without it the site has nothing to serve, and guessing a default would point it at the wrong server.
   */
  MYSQL_HOST: z.string().min(1).optional(),
  MYSQL_PORT: z.coerce.number().int().positive().max(65535).default(3306),
  MYSQL_USER: z.string().min(1).optional(),
  MYSQL_PASSWORD: z.string().optional(),
  MYSQL_DATABASE: z.string().min(1).optional(),
  MYSQL_TLS: tlsMode,
  MYSQL_CA_FILE: z.string().optional(),
  /** Browser origins allowed to send state-changing requests (the public frontend), comma separated */
  ALLOWED_ORIGINS: commaList.default([]),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  // Fail at startup rather than on the first request, and never fall back to a guessed host.
  for (const key of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'] as const) {
    if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
  }
  // An unverified connection to the HR database can be read or rewritten in transit.
  for (const key of ['MYSQL_TLS', 'DATABASE_TLS'] as const) {
    if (env[key] === 'off') ctx.addIssue({ code: 'custom', path: [key], message: 'Must be "verify" in production' });
  }
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
