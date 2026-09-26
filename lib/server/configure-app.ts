import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { requestContextMiddleware } from '@/lib/http/request-context';
import type { AppConfig } from '@/config/env';

export const API_PREFIX = 'api/v1';

/** Everything main.ts sets up on the app, shared with the e2e tests so they exercise the same stack. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.use(requestContextMiddleware);
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors(
    config.CORS_ORIGINS.length > 0 ? { origin: config.CORS_ORIGINS, credentials: true } : { origin: false },
  );
  app.enableShutdownHooks();
}
