"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACT_PATHS = void 0;
exports.loggerOptions = loggerOptions;
const common_1 = require("@nestjs/common");
/**
 * Paths pino replaces with "[redacted]". Request bodies are never logged, so these cover headers
 * and objects passed to the logger explicitly.
 */
exports.REDACT_PATHS = [
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
function loggerOptions(config) {
    return {
        // nestjs-pino defaults to "*", which Express 5's router warns about and rewrites
        forRoutes: [{ path: '{*path}', method: common_1.RequestMethod.ALL }],
        pinoHttp: {
            level: config.LOG_LEVEL,
            // requestContextMiddleware has already set req.id
            genReqId: (req) => req.id,
            redact: { paths: exports.REDACT_PATHS, censor: '[redacted]' },
            autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url?.split('?')[0] ?? '') },
            customLogLevel: (_req, res, err) => {
                if (err || res.statusCode >= 500)
                    return 'error';
                if (res.statusCode >= 400)
                    return 'warn';
                return 'info';
            },
            serializers: {
                req: (req) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                }),
                res: (res) => ({ statusCode: res.statusCode }),
            },
            transport: config.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
                : undefined,
        },
    };
}
//# sourceMappingURL=logger.options.js.map