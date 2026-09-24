import { type CallHandler, type ExecutionContext, Injectable, InternalServerErrorException, Logger, type NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';
import { currentRequest } from '../common/request-context';
import { InjectConfig, type AppConfig } from '../config/config.module';

export const NO_AUDIT = 'audit:none';

/**
 * Marks a write endpoint that never records an audit row, and says why (plan §8: every other change
 * is audited). The reason is listed by the route inventory test.
 */
export const NoAudit = (reason: string) => SetMetadata(NO_AUDIT, reason);

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Checks, after every successful write, that it recorded an audit row, marked itself skipped
 * (`AuditService.skip`) or is `@NoAudit`. With AUDIT_STRICT (the tests) a miss fails the request, so a
 * new endpoint without auditing can't pass its own tests; otherwise it is logged.
 */
@Injectable()
export class AuditCoverageInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditCoverage');

  constructor(
    private readonly reflector: Reflector,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const exempt = this.reflector.getAllAndOverride<string | undefined>(NO_AUDIT, [context.getHandler(), context.getClass()]);
    if (!WRITES.has(req.method) || exempt) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const store = currentRequest();
        if (!store || (store.auditWrites ?? 0) > 0 || store.auditSkipped) return;
        const route = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
        if (this.config.AUDIT_STRICT) throw new InternalServerErrorException(`No audit entry was written for ${route}`);
        this.logger.warn({ route }, 'A write succeeded without an audit entry');
      }),
    );
  }
}
