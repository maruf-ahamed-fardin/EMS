import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG } from '../src/config/config.module';
import { parseEnv } from '../src/config/env';
import { AttendanceService } from '../src/attendance/attendance.service';
import { configureApp } from '../src/configure-app';
import { DocumentExpiryReminders } from '../src/documents/document-expiry';
import { LeaveBalancesService } from '../src/leave/leave-balances.service';
import { PrismaService } from '../src/prisma/prisma.service';

/** The HTTP stack without a database: prefix, headers, request ids and the error format. */
describe('API shell (no database)', () => {
  let app: NestExpressApplication;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://unused@127.0.0.1:1/unused',
      JOBS_ENABLED: 'false',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw, $disconnect: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness under /api/v1 without caching', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a caller-supplied request id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').set('x-request-id', 'trace-from-next-1');
    expect(res.headers['x-request-id']).toBe('trace-from-next-1');
  });

  it('reports ready when the database answers', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'ok' } });
  });

  it('reports 503 without leaking why when the database is down', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connect ECONNREFUSED postgresql://ems:secret@db/ems'));
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(res.body).toEqual({ status: 'unavailable', checks: { database: 'failed' } });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('returns unknown routes in the API error format', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'Not found', requestId: res.headers['x-request-id'] });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers 401 on a protected route without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, message: 'You need to sign in' });
  });

  it('issues a CSRF cookie that the page can read', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ems_csrf='));
    expect(cookie).toBeDefined();
    expect(cookie).not.toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.data.csrfToken).toBe(cookie?.split(';')[0]?.split('=')[1]);
  });

  it('rejects a write without the CSRF token (the mocked database has no users, so reaching it would be a 500)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('origin', 'http://localhost:3000')
      .send({ email: 'a@b.co', password: 'x' })
      .expect(403);
    expect(res.body.message).toMatch(/Reload the page/);
  });

  it('rejects a write from another site even with a token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('origin', 'https://evil.example')
      .set('cookie', 'ems_csrf=abcdefghijklmnopqrstuvwxyz0123456789')
      .set('x-csrf-token', 'abcdefghijklmnopqrstuvwxyz0123456789')
      .send({ email: 'a@b.co', password: 'x' })
      .expect(403);
  });

  it('validates login input and reports each field', async () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('origin', 'http://localhost:3000')
      .set('cookie', `ems_csrf=${token}`)
      .set('x-csrf-token', token)
      .send({ email: 'not-an-email', password: '' })
      .expect(422);
    expect(res.body.errors).toEqual({ email: 'Enter a valid email address', password: 'Enter your password' });
  });

  it('does not allow cross-origin browser calls by default', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').set('origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('has no job route without CRON_SECRET, whatever the caller sends', async () => {
    await request(app.getHttpServer()).get('/api/v1/jobs/run').set('authorization', 'Bearer undefined').expect(404);
    await request(app.getHttpServer()).get('/api/v1/jobs/run').set('authorization', 'Bearer ').expect(404);
  });
});

describe('Job route (no database)', () => {
  const SECRET = 'a-cron-secret-that-is-long-enough-0123456789';
  const closePendingDays = jest.fn().mockResolvedValue([]);
  const runReminders = jest.fn().mockResolvedValue({ created: 0 });
  const ensureYear = jest.fn().mockResolvedValue(0);
  let app: NestExpressApplication;

  beforeAll(async () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://unused@127.0.0.1:1/unused',
      JOBS_ENABLED: 'false',
      CRON_SECRET: SECRET,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(AttendanceService)
      .useValue({ closePendingDays })
      .overrideProvider(DocumentExpiryReminders)
      .useValue({ run: runReminders })
      .overrideProvider(LeaveBalancesService)
      .useValue({ ensureYear, currentYear: jest.fn().mockResolvedValue(2026) })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('answers 404 and runs nothing without the right secret', async () => {
    await request(app.getHttpServer()).get('/api/v1/jobs/run').expect(404);
    await request(app.getHttpServer()).get('/api/v1/jobs/run').set('authorization', `Bearer ${SECRET}x`).expect(404);
    await request(app.getHttpServer()).get('/api/v1/jobs/run').set('authorization', SECRET).expect(404);
    expect(closePendingDays).not.toHaveBeenCalled();
    expect(runReminders).not.toHaveBeenCalled();
    expect(ensureYear).not.toHaveBeenCalled();
  });

  it('runs every job with the secret, and one failure does not stop the others', async () => {
    closePendingDays.mockRejectedValueOnce(new Error('database down'));
    const res = await request(app.getHttpServer()).get('/api/v1/jobs/run').set('authorization', `Bearer ${SECRET}`).expect(200);
    expect(res.body).toEqual({ data: { closeAttendanceDays: 'failed', documentExpiryReminders: 'ok', ensureLeaveBalances: 'ok' } });
    expect(runReminders).toHaveBeenCalledTimes(1);
    expect(ensureYear).toHaveBeenCalledWith(2026);
  });

  it('refuses a secret shorter than 32 characters at start-up', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgresql://unused@127.0.0.1:1/unused', CRON_SECRET: 'short' })).toThrow(/CRON_SECRET/);
  });
});
