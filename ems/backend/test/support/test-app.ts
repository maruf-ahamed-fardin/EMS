import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { syncCatalogue } from '../../src/catalogue/sync-catalogue';
import { APP_CONFIG } from '../../src/config/config.module';
import { parseEnv } from '../../src/config/env';
import { Clock } from '../../src/common/clock';
import { configureApp } from '../../src/configure-app';
import { MAILER, MemoryMailer } from '../../src/mail/mailer';
import { PrismaService } from '../../src/prisma/prisma.service';
import { seedDemoData } from '../../prisma/demo-data';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
/** `describe` when a test database is configured, `describe.skip` otherwise. */
export const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

export const APP_ORIGIN = 'http://localhost:3000';
export const DEMO_PASSWORD = 'lantern-river-canopy-47';

/** Drops and re-creates the schema from the migrations. The database name must contain "test". */
export function resetDatabase(url: string): void {
  if (!new URL(url).pathname.includes('test')) {
    throw new Error('TEST_DATABASE_URL must name a database containing "test"; it is wiped');
  }
  const cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
  execFileSync(process.execPath, [cli, 'migrate', 'reset', '--force'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
}

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  mailer: MemoryMailer;
  close: () => Promise<void>;
}

/** A fresh database with the catalogue and one demo user per role, and the real app on top. */
export async function startTestApp(options: { clock?: Clock } = {}): Promise<TestApp> {
  const url = TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  resetDatabase(url);

  const config = parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: url, APP_URL: APP_ORIGIN, TRUST_PROXY_HOPS: '1', JOBS_ENABLED: 'false' });
  const mailer = new MemoryMailer();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(MAILER)
    .useValue(mailer);
  // Tests that depend on the time of day pass a FixedClock they can move
  if (options.clock) builder = builder.overrideProvider(Clock).useValue(options.clock);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, config);
  await app.init();

  const prisma = app.get(PrismaService);
  await syncCatalogue(prisma);
  await seedDemoData(prisma, await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id }));

  return { app, prisma, mailer, close: () => app.close() };
}

function cookieValue(setCookie: string | string[] | undefined, name: string): string | undefined {
  const header = ([] as string[]).concat(setCookie ?? []).find((cookie) => cookie.startsWith(`${name}=`));
  return header?.split(';')[0]?.slice(name.length + 1);
}

/**
 * A browser-like client: keeps cookies, fetches the CSRF token, and sends the Origin, Sec-Fetch-Site
 * and token headers the web app sends on every write.
 */
export class TestBrowser {
  readonly agent: ReturnType<typeof request.agent>;
  private csrf: string | undefined;

  constructor(app: NestExpressApplication, private readonly ip = '203.0.113.10') {
    this.agent = request.agent(app.getHttpServer());
  }

  get(path: string) {
    return this.agent.get(`/api/v1${path}`).set('x-forwarded-for', this.ip);
  }

  private async token(): Promise<string> {
    if (!this.csrf) {
      const res = await this.get('/auth/csrf');
      this.csrf = (res.body as { data: { csrfToken: string } }).data.csrfToken;
    }
    return this.csrf;
  }

  async patch(path: string, body: object) {
    return this.agent
      .patch(`/api/v1${path}`)
      .set('x-forwarded-for', this.ip)
      .set('origin', APP_ORIGIN)
      .set('sec-fetch-site', 'same-origin')
      .set('x-csrf-token', await this.token())
      .send(body);
  }

  async delete(path: string) {
    return this.agent
      .delete(`/api/v1${path}`)
      .set('x-forwarded-for', this.ip)
      .set('origin', APP_ORIGIN)
      .set('sec-fetch-site', 'same-origin')
      .set('x-csrf-token', await this.token());
  }

  async post(path: string, body?: object) {
    const token = await this.token();
    const res = await this.agent
      .post(`/api/v1${path}`)
      .set('x-forwarded-for', this.ip)
      .set('origin', APP_ORIGIN)
      .set('sec-fetch-site', 'same-origin')
      .set('x-csrf-token', token)
      .send(body ?? {});
    // Login and logout rotate the token
    const rotated = cookieValue(res.headers['set-cookie'], 'ems_csrf');
    if (rotated !== undefined) this.csrf = rotated || undefined;
    return res;
  }

  login(email: string, password = DEMO_PASSWORD) {
    return this.post('/auth/login', { email, password });
  }

  sessionCookie(res: request.Response): string | undefined {
    return cookieValue(res.headers['set-cookie'], 'ems_session');
  }
}
