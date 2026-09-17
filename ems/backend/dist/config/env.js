"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidEnvironmentError = void 0;
exports.parseEnv = parseEnv;
const zod_1 = require("zod");
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const SECURE_SSL_MODES = new Set(['require', 'verify-ca', 'verify-full']);
const commaList = zod_1.z
    .string()
    .default('')
    .transform((value) => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean));
const envSchema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: zod_1.z.enum(LOG_LEVELS).default('info'),
    DATABASE_URL: zod_1.z
        .string()
        .min(1)
        .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// URL'),
    /** Only for trusted private networks (such as a compose network) in production. */
    DATABASE_ALLOW_INSECURE: zod_1.z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    /** Browser origins allowed to call the API directly. Production is same-origin, so usually empty. */
    CORS_ORIGINS: commaList,
    /** Proxy hops in front of the API (Next.js rewrite, load balancer). Used for client IPs. */
    TRUST_PROXY_HOPS: zod_1.z.coerce.number().int().min(0).max(10).default(1),
})
    .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production' || env.DATABASE_ALLOW_INSECURE)
        return;
    const sslMode = safeSslMode(env.DATABASE_URL);
    if (!sslMode || !SECURE_SSL_MODES.has(sslMode)) {
        ctx.addIssue({
            code: 'custom',
            path: ['DATABASE_URL'],
            message: 'needs sslmode=verify-full (or require) in production',
        });
    }
});
function safeSslMode(url) {
    try {
        return new URL(url).searchParams.get('sslmode');
    }
    catch {
        return null;
    }
}
class InvalidEnvironmentError extends Error {
    problems;
    constructor(problems) {
        super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
        this.problems = problems;
        this.name = 'InvalidEnvironmentError';
    }
}
exports.InvalidEnvironmentError = InvalidEnvironmentError;
/**
 * Validates the environment once at startup. Error messages name the variable and the rule it
 * broke, never its value: connection URLs carry passwords and startup errors end up in logs.
 */
function parseEnv(source = process.env) {
    const result = envSchema.safeParse(source);
    if (result.success)
        return result.data;
    const problems = result.error.issues.map((issue) => {
        const name = issue.path.join('.') || '(environment)';
        const rule = issue.code === 'invalid_type' && issue.input === undefined ? 'is required' : issue.message;
        return `${name} ${rule}`;
    });
    throw new InvalidEnvironmentError(problems);
}
//# sourceMappingURL=env.js.map