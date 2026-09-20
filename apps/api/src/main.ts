import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/config.module';
import { configureApp } from './configure-app';
import { InvalidEnvironmentError } from './config/env';
import { loadRepoEnv } from './config/load-env';

async function bootstrap(): Promise<void> {
  // Local development reads the repository's .env; containers and CI pass real environment variables.
  loadRepoEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);

  await app.listen(config.PORT);
  app.get(Logger).log(`API listening on http://localhost:${config.PORT}/api/v1`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // The logger may not exist yet, and InvalidEnvironmentError messages are safe to print.
  const message = error instanceof InvalidEnvironmentError ? error.message : error;
  console.error(message);
  process.exit(1);
});
