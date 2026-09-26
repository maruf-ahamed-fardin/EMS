import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ListResponse, type NotificationItem, type NotificationListQuery, type NotificationType, pageMeta, type PermissionKey } from '@/lib/validations';
import type { Prisma } from '@/lib/db/generated/prisma/client';
import { PrismaService } from '@/lib/db/prisma';

type Db = PrismaService | Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NotifyInput {
  userIds: Iterable<string>;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  entity?: { type: string; id: string };
  /**
   * Makes a repeating trigger (a reminder, a job that runs every hour) notify each user once:
   * a second notify with the same key for the same user is skipped.
   */
  dedupeKey?: string;
}

export type NotificationRow = Prisma.NotificationGetPayload<object>;

/**
 * Where a notification goes once written (plan §9). The in-app channel is the row itself. Email, SMS or
 * push channels implement this later; because `notify` can run inside the caller's transaction, such a
 * channel must queue its message (an outbox) rather than send it, so a rolled-back change never mails.
 */
export interface NotificationChannel {
  readonly name: string;
  deliver(rows: NotificationRow[]): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';

  deliver(): Promise<void> {
    // The row is the in-app notification; the bell reads it
    return Promise.resolve();
  }
}

function toItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  /**
   * Writes one notification per user and hands the new rows to every channel. Pass the caller's
   * transaction so the notification exists exactly when the change it describes does.
   * Returns how many were created (duplicates by `dedupeKey` are skipped).
   */
  async notify(input: NotifyInput, db: Db = this.prisma): Promise<number> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return 0;
    const rows = await db.notification.createManyAndReturn({
      data: userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        entityType: input.entity?.type ?? null,
        entityId: input.entity?.id ?? null,
        dedupeKey: input.dedupeKey ?? null,
      })),
      skipDuplicates: true,
    });
    for (const channel of this.channels) await channel.deliver(rows);
    return rows.length;
  }

  // ─── Recipients ─────────────────────────────────────────────────────────────────────────────

  /** Active users whose role grants `key` at ALL: "HR" for that kind of work. */
  async usersWithAll(key: PermissionKey, db: Db = this.prisma): Promise<string[]> {
    const users = await db.user.findMany({
      where: { status: 'ACTIVE', role: { permissions: { some: { scope: 'ALL', permission: { key } } } } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** The active sign-in account of an employee, if they have one and their role grants `key` (any scope). */
  async accountOf(employeeId: string | null, key: PermissionKey | null, db: Db = this.prisma): Promise<string | null> {
    if (!employeeId) return null;
    const user = await db.user.findFirst({
      where: { employeeId, status: 'ACTIVE', ...(key ? { role: { permissions: { some: { permission: { key } } } } } : {}) },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  // ─── Reading (always the caller's own) ───────────────────────────────────────────────────────

  async list(userId: string, query: NotificationListQuery): Promise<ListResponse<NotificationItem>> {
    const where: Prisma.NotificationWhereInput = { userId, ...(query.unread ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.notification.count({ where }),
    ]);
    return { data: rows.map(toItem), meta: pageMeta(query.page, query.limit, total) };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Someone else's notification is simply not found. Reading twice keeps the first time. */
  async markRead(userId: string, id: string): Promise<NotificationItem> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    if (row.readAt) return toItem(row);
    return toItem(await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }));
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return count;
  }
}
