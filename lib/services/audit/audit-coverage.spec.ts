import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { type RequestContext, runWithContext } from '@/lib/http/request-context';
import { parseEnv } from '@/config/env';
import { AuditCoverageInterceptor, NoAudit } from './audit-coverage';

class Handlers {
  write(): void {}
  @NoAudit('Only reads, for this test')
  exempt(): void {}
}

function contextFor(method: string, handler: keyof Handlers): ExecutionContext {
  const req = { method, route: { path: '/things/:id' }, path: '/things/1' };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => Handlers.prototype[handler],
    getClass: () => Handlers,
  } as unknown as ExecutionContext;
}

const next: CallHandler = { handle: () => of({ ok: true }) };

function run(strict: boolean, method: string, handler: keyof Handlers, store: Partial<RequestContext>) {
  const interceptor = new AuditCoverageInterceptor(new Reflector(), parseEnv({ DATABASE_URL: 'postgresql://x@h/db', AUDIT_STRICT: String(strict) }));
  return runWithContext({ requestId: 'r1', ip: undefined, userAgent: undefined, ...store }, () => lastValueFrom(interceptor.intercept(contextFor(method, handler), next)));
}

describe('audit coverage check', () => {
  it('fails a successful write that recorded nothing, naming the route (strict)', async () => {
    await expect(run(true, 'PATCH', 'write', {})).rejects.toThrow('No audit entry was written for PATCH /things/:id');
  });

  it('passes a write that recorded an entry, or said why it skipped', async () => {
    await expect(run(true, 'POST', 'write', { auditWrites: 1 })).resolves.toEqual({ ok: true });
    await expect(run(true, 'PATCH', 'write', { auditSkipped: 'Nothing changed' })).resolves.toEqual({ ok: true });
  });

  it('leaves reads and @NoAudit endpoints alone', async () => {
    await expect(run(true, 'GET', 'write', {})).resolves.toEqual({ ok: true });
    await expect(run(true, 'POST', 'exempt', {})).resolves.toEqual({ ok: true });
  });

  it('only logs outside strict mode, so production requests still succeed', async () => {
    await expect(run(false, 'DELETE', 'write', {})).resolves.toEqual({ ok: true });
  });
});
