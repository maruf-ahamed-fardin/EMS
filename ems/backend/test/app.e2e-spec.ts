import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_CONFIG } from '../src/config/config.module';
import { parseEnv } from '../src/config/env';
import { configureApp } from '../src/configure-app';
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

  it('does not allow cross-origin browser calls by default', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').set('origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
