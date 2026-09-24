import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/config.module';
import { configureApp } from './configure-app';
import { loadRepoEnv } from './config/load-env';

/** The running API, as the web app sees it. Declared again in apps/web/src/server/ems-backend.d.ts. */
export interface EmbeddedApi {
  /** http://127.0.0.1:<port>, reachable only from inside this machine or container */
  origin: string;
  close(): Promise<void>;
}

/**
 * Starts the API inside the web app's Node process (apps/web/src/server/embedded-api.ts), on a random
 * port on the loopback interface. Nothing outside the process's machine can connect to it: browsers
 * reach it only through the web app's /api route, which forwards each request unchanged, so every
 * guard, pipe and filter runs exactly as it did when the API was a server of its own.
 */
export async function startEmbeddedApi(): Promise<EmbeddedApi> {
  // Local development reads the repository's .env; Vercel and containers pass real environment variables.
  loadRepoEnv();

  // A bad environment rejects here with an InvalidEnvironmentError, whose message names the variable,
  // never the value
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);

  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  app.get(Logger).log(`API listening on http://127.0.0.1:${port}/api/v1 (inside the web app)`, 'Bootstrap');

  return { origin: `http://127.0.0.1:${port}`, close: () => app.close() };
}
