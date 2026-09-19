import type { IncomingMessage } from 'node:http';
import { RequestMethod } from '@nestjs/common';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config/env';

/**
 * Paths pino replaces with "[redacted]". Request bodies are never logged, so these cover headers
 * and objects passed to the logger explicitly.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
  '*.storageKey',
  '*.DATABASE_URL',
];

const QUIET_PATHS = new Set(['/api/v1/health', '/api/v1/health/ready']);

/**
 * A URL fit for the logs: download links carry their authority in the path (/files/<token>, valid for
 * 60 seconds), and any `token` query value is a credential too.
 */
export function safeUrl(url: string | undefined): string | undefined {
  return url?.replace(/(\/files\/)[^/?#]+/, '$1[redacted]').replace(/([?&]token=)[^&#]*/gi, '$1[redacted]');
}

export function loggerOptions(config: AppConfig): Params {
  return {
    // nestjs-pino defaults to "*", which Express 5's router warns about and rewrites
    forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: config.LOG_LEVEL,
      // requestContextMiddleware has already set req.id
      genReqId: (req: IncomingMessage) => (req as IncomingMessage & { id: string }).id,
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url?.split('?')[0] ?? '') },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: safeUrl(req.url),
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
          : undefined,
    },
  };
}
