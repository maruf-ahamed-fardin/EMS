import pino from 'pino';

export type { Logger } from 'pino';

// Reads process.env directly rather than getEnv() so a bad configuration can still be logged
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'teamprofile' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password', '*.password', 'token', '*.token', 'secret', '*.secret',
      'headers.cookie', 'headers.authorization', '*.headers.cookie', '*.headers.authorization',
      'DATABASE_URL', 'KV_DATABASE_URL', '*.DATABASE_URL', '*.KV_DATABASE_URL',
    ],
    censor: '[redacted]',
  },
});
