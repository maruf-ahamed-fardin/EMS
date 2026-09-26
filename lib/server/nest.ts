import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { InvalidEnvironmentError } from '@/config/env';
import { loadRepoEnv } from '@/config/load-env';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

/**
 * The API (the NestJS modules in lib/services, lib/auth and lib/http) runs inside the Next.js server:
 * started once per server process on a private loopback port, and reached through
 * app/api/[...path]/route.ts and lib/client/server-api.ts. Nothing outside this process can connect
 * to it: it listens on 127.0.0.1 with a port the OS picks.
 */
async function start(): Promise<string> {
  // Local development reads the repository's .env; Vercel and CI pass real environment variables.
  loadRepoEnv();

  // abortOnError: false, so a bad configuration fails this call instead of exiting the whole server
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, abortOnError: false });
  app.useLogger(app.get(Logger));
  configureApp(app, app.get<AppConfig>(APP_CONFIG));

  const server = await app.listen(0, '127.0.0.1');
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

// On globalThis, so hot reloads in development reuse the running API instead of starting another
const holder = globalThis as typeof globalThis & { __emsApi?: Promise<string> };

/** The in-process API's origin, starting it on first use. */
export function apiOrigin(): Promise<string> {
  holder.__emsApi ??= start().catch((error: unknown) => {
    holder.__emsApi = undefined;
    // InvalidEnvironmentError names the variable, never its value, so it is safe to log
    console.error(error instanceof InvalidEnvironmentError ? error.message : error);
    throw error;
  });
  return holder.__emsApi;
}
