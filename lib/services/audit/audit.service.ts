import { Injectable } from '@nestjs/common';
import { currentRequest } from '@/lib/http/request-context';
import { DashboardCache } from '@/lib/services/dashboard/dashboard-cache';
import type { Prisma } from '@/lib/db/generated/prisma/client';
import { PrismaService } from '@/lib/db/prisma';
import { auditView } from './redaction';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Defaults to the signed-in user of the current request. */
  actorUserId?: string | null;
}

type Db = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardCache: DashboardCache,
  ) {}

  /**
   * Writes one audit row. Pass the transaction client when recording a change, so the row commits or
   * rolls back with it. Actor, IP, user agent and request id come from the request context.
   *
   * Every data change is audited, so this is also where cached dashboard numbers are dropped. The row
   * may still be inside an uncommitted transaction, and a dashboard read in that gap would cache the
   * old numbers, so the cache is cleared once more shortly afterwards.
   */
  async record(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    if (!entry.action.startsWith('auth.')) {
      this.dashboardCache.invalidate();
      setTimeout(() => this.dashboardCache.invalidate(), 2000).unref();
    }
    const context = currentRequest();
    await db.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (auditView(entry.entityType, entry.before) ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (auditView(entry.entityType, entry.after) ?? undefined) as Prisma.InputJsonValue | undefined,
        actorUserId: entry.actorUserId !== undefined ? entry.actorUserId : (context?.userId ?? null),
        ip: context?.ip ?? null,
        userAgent: context?.userAgent?.slice(0, 500) ?? null,
        requestId: context?.requestId ?? 'system',
      },
    });
    if (context) context.auditWrites = (context.auditWrites ?? 0) + 1;
  }

  /**
   * Says that this request changes nothing worth recording (an edit with no real change, a reset
   * request for an unknown email). Without it, a successful write that records nothing fails the audit
   * coverage check.
   */
  skip(reason: string): void {
    const context = currentRequest();
    if (context) context.auditSkipped = reason;
  }
}
