import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DOCUMENT_EXPIRY_WARNING_DAYS } from '@ems/contracts';
import { CalendarService } from '../calendar/calendar.service';
import { addDays, dateOnly } from '../calendar/work-calendar';
import { Clock } from '../common/clock';
import { InjectConfig, type AppConfig } from '../config/config.module';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Reminders go out 30, 7 and 0 days before a document expires (plan §7). */
export const EXPIRY_REMINDER_DAYS = [30, 7, 0] as const;

/**
 * Which reminder is due with `daysLeft` to go: the nearest one already reached, or null. A document
 * uploaded with 5 days left gets the 7-day reminder, not a late 30-day one as well.
 */
export function reminderStage(daysLeft: number): (typeof EXPIRY_REMINDER_DAYS)[number] | null {
  if (daysLeft < 0 || daysLeft > DOCUMENT_EXPIRY_WARNING_DAYS) return null;
  if (daysLeft === 0) return 0;
  return daysLeft <= 7 ? 7 : 30;
}

function when(daysLeft: number): string {
  if (daysLeft === 0) return 'today';
  return daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
}

/**
 * Tells HR and the employee when a document is about to expire. Runs at start-up and every hour;
 * `dedupe_key` makes each reminder arrive exactly once, however often it runs. The notification bell
 * and the channel interface arrive in Phase 9; this writes the in-app rows they will show.
 */
@Injectable()
export class DocumentExpiryReminders implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentExpiryReminders.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
    private readonly clock: Clock,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    void this.runScheduled();
  }

  @Interval('document-expiry-reminders', 60 * 60 * 1000)
  async runScheduled(): Promise<void> {
    if (!this.config.JOBS_ENABLED) return;
    try {
      await this.run();
    } catch (error) {
      this.logger.error({ err: error }, 'Document expiry reminders failed; the next run retries');
    }
  }

  async run(): Promise<{ created: number }> {
    const today = await this.calendar.today(this.clock.now());
    const documents = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        employee: { deletedAt: null },
        expiresAt: { gte: dateOnly(today), lte: dateOnly(addDays(today, DOCUMENT_EXPIRY_WARNING_DAYS)) },
      },
      select: {
        id: true,
        title: true,
        expiresAt: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true, user: { select: { id: true, status: true } } } },
        documentType: { select: { name: true, isSensitive: true } },
      },
    });
    if (documents.length === 0) return { created: 0 };

    // HR: whoever sees every employee's documents, and for sensitive ones every employee's private details too
    const grantedAll = (key: string) => ({ status: 'ACTIVE' as const, role: { permissions: { some: { scope: 'ALL' as const, permission: { key } } } } });
    const [hr, hrPrivate] = await Promise.all([
      this.prisma.user.findMany({ where: grantedAll('document.view'), select: { id: true } }),
      this.prisma.user.findMany({ where: grantedAll('employee.view_private'), select: { id: true } }),
    ]);
    const hrIds = hr.map((u) => u.id);
    const privateIds = new Set(hrPrivate.map((u) => u.id));

    const rows: Prisma.NotificationCreateManyInput[] = [];
    for (const document of documents) {
      const daysLeft = Math.round((document.expiresAt!.getTime() - dateOnly(today).getTime()) / 86_400_000);
      const stage = reminderStage(daysLeft);
      if (stage === null) continue;
      const name = `${document.employee.firstName} ${document.employee.lastName}`;
      const base = { type: 'document.expiring', entityType: 'document', entityId: document.id, dedupeKey: `document-expiry:${document.id}:${stage}` };
      const owner = document.employee.user?.status === 'ACTIVE' ? document.employee.user.id : null;

      for (const userId of hrIds) {
        if (userId === owner || (document.documentType.isSensitive && !privateIds.has(userId))) continue;
        rows.push({
          ...base,
          userId,
          title: `${document.documentType.name} for ${name} expires ${when(daysLeft)}`,
          body: `"${document.title}" expires on ${document.expiresAt!.toISOString().slice(0, 10)}.`,
          link: `/employees/${document.employeeId}?tab=documents`,
        });
      }
      if (owner) {
        rows.push({
          ...base,
          userId: owner,
          title: `Your ${document.documentType.name} expires ${when(daysLeft)}`,
          body: `"${document.title}" expires on ${document.expiresAt!.toISOString().slice(0, 10)}. Upload the renewed one when you have it.`,
          link: '/documents',
        });
      }
    }
    if (rows.length === 0) return { created: 0 };
    const { count } = await this.prisma.notification.createMany({ data: rows, skipDuplicates: true });
    if (count > 0) this.logger.log({ created: count }, 'Sent document expiry reminders');
    return { created: count };
  }
}
