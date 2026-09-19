import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const SECURE_SSL_MODES = new Set(['require', 'verify-ca', 'verify-full']);

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

    DATABASE_URL: z
      .string()
      .min(1)
      .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// URL'),
    /** Only for trusted private networks (such as a compose network) in production. */
    DATABASE_ALLOW_INSECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    /** Browser origins allowed to call the API directly. Production is same-origin, so usually empty. */
    CORS_ORIGINS: commaList,
    /** Proxy hops in front of the API (Next.js rewrite, load balancer). Used for client IPs. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),

    /**
     * The web app's public URL. Writes must come from this origin (CSRF check), links in emails point
     * here, and an https URL makes the cookies Secure.
     */
    APP_URL: z
      .url({ protocol: /^https?$/, message: 'must be an http(s) URL' })
      .default('http://localhost:3000')
      .transform((value) => new URL(value).origin),

    /** Background jobs (closing attendance days). Tests and one-off scripts turn them off. */
    JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
    /** smtp://user:pass@host:port. Required when MAIL_DRIVER=smtp. */
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().min(3).default('SeloraX People <no-reply@selorax.local>'),

    /**
     * Where documents are kept (decision D4). `local` writes to STORAGE_LOCAL_DIR and serves 60-second
     * signed links itself; it is for development and tests only. `s3` is any S3-compatible private
     * bucket (AWS S3, Cloudflare R2, MinIO).
     */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().min(1).default('./storage'),
    S3_BUCKET: z.string().optional(),
    /** `auto` for Cloudflare R2. */
    S3_REGION: z.string().min(1).default('us-east-1'),
    /** Only for providers other than AWS, e.g. https://<account>.r2.cloudflarestorage.com. */
    S3_ENDPOINT: z.url({ protocol: /^https?$/, message: 'must be an http(s) URL' }).optional(),
    /** Leave both keys empty to use the platform's credentials (such as an IAM role). */
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_DRIVER === 'smtp' && !env.SMTP_URL?.match(/^smtps?:\/\//)) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'must be an smtp:// or smtps:// URL when MAIL_DRIVER=smtp' });
    }
    if (env.STORAGE_DRIVER === 's3') {
      if (!env.S3_BUCKET) ctx.addIssue({ code: 'custom', path: ['S3_BUCKET'], message: 'is required when STORAGE_DRIVER=s3' });
      if (Boolean(env.S3_ACCESS_KEY_ID) !== Boolean(env.S3_SECRET_ACCESS_KEY)) {
        ctx.addIssue({ code: 'custom', path: ['S3_SECRET_ACCESS_KEY'], message: 'and S3_ACCESS_KEY_ID must be set together' });
      }
    }
    if (env.NODE_ENV !== 'production') return;

    if (!env.DATABASE_ALLOW_INSECURE) {
      const sslMode = safeSslMode(env.DATABASE_URL);
      if (!sslMode || !SECURE_SSL_MODES.has(sslMode)) {
        ctx.addIssue({
          code: 'custom',
          path: ['DATABASE_URL'],
          message: 'needs sslmode=verify-full (or require) in production',
        });
      }
    }
    if (!env.APP_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'must be https in production' });
    }
    // Console mail would silently drop every password reset
    if (env.MAIL_DRIVER !== 'smtp') {
      ctx.addIssue({ code: 'custom', path: ['MAIL_DRIVER'], message: 'must be smtp in production' });
    }
    // A container's disk is lost on redeploy, and several instances wouldn't share it
    if (env.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'must be s3 in production' });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

function safeSslMode(url: string): string | null {
  try {
    return new URL(url).searchParams.get('sslmode');
  } catch {
    return null;
  }
}

export class InvalidEnvironmentError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'InvalidEnvironmentError';
  }
}

/**
 * Validates the environment once at startup. Error messages name the variable and the rule it
 * broke, never its value: connection URLs carry passwords and startup errors end up in logs.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(environment)';
    const rule = issue.code === 'invalid_type' && issue.input === undefined ? 'is required' : issue.message;
    return `${name} ${rule}`;
  });
  throw new InvalidEnvironmentError(problems);
}
