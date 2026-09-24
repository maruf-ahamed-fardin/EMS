import { Controller, Get, Logger, Module, NotFoundException, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AttendanceModule } from '../attendance/attendance.controller';
import { AttendanceService } from '../attendance/attendance.service';
import { Public } from '../auth/decorators';
import { safeEqual } from '../common/security/tokens';
import { InjectConfig, type AppConfig } from '../config/config.module';
import { DocumentExpiryReminders } from '../documents/document-expiry';
import { DocumentsModule } from '../documents/documents.controller';
import { LeaveBalancesService } from '../leave/leave-balances.service';
import { LeaveModule } from '../leave/leave.controller';

/**
 * The background jobs on demand, for hosts where the API only runs while it answers a request
 * (Vercel Cron calls this once a day). Every job is safe to run any number of times, and each one
 * runs even if another fails. Without CRON_SECRET, or with the wrong one, the route doesn't exist.
 */
@Public()
@SkipThrottle()
@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly attendance: AttendanceService,
    private readonly documentExpiry: DocumentExpiryReminders,
    private readonly balances: LeaveBalancesService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  @Get('run')
  async run(@Req() req: Request): Promise<{ data: Record<string, 'ok' | 'failed'> }> {
    const secret = this.config.CRON_SECRET;
    if (!secret || !safeEqual(req.get('authorization') ?? '', `Bearer ${secret}`)) throw new NotFoundException();

    const jobs = {
      closeAttendanceDays: () => this.attendance.closePendingDays(),
      documentExpiryReminders: () => this.documentExpiry.run(),
      ensureLeaveBalances: async () => this.balances.ensureYear(await this.balances.currentYear()),
    };
    const data: Record<string, 'ok' | 'failed'> = {};
    for (const [name, job] of Object.entries(jobs)) {
      data[name] = await job().then(
        () => 'ok' as const,
        (error: unknown) => {
          this.logger.error({ err: error, job: name }, 'Background job failed; the next run retries');
          return 'failed' as const;
        },
      );
    }
    return { data };
  }
}

@Module({
  imports: [AttendanceModule, DocumentsModule, LeaveModule],
  controllers: [JobsController],
})
export class JobsModule {}
