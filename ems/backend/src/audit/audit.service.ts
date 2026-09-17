import { Injectable } from '@nestjs/common';
import { currentRequest } from '../common/request-context';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one audit row. Pass the transaction client when recording a change, so the row commits or
   * rolls back with it. Actor, IP, user agent and request id come from the request context.
   */
  async record(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
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
  }
}
