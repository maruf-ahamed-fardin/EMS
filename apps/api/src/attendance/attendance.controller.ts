import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Logger, Module, type OnApplicationBootstrap, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  type AttendanceItem,
  attendanceListQuery,
  type AttendanceSummary,
  attendanceSummaryQuery,
  closeDayInput,
  correctAttendanceInput,
  createAttendanceInput,
  type DataResponse,
  type ListResponse,
  type MyAttendanceToday,
} from '@ems/contracts';
import type { Request } from 'express';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { NoAudit } from '../audit/audit-coverage';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { InjectConfig, type AppConfig } from '../config/config.module';
import { AttendanceIngestService } from './attendance-ingest.service';
import { AttendanceService } from './attendance.service';

class AttendanceListQueryDto extends createZodDto(attendanceListQuery) {}
class AttendanceSummaryQueryDto extends createZodDto(attendanceSummaryQuery) {}
class CorrectAttendanceDto extends createZodDto(correctAttendanceInput) {}
class CreateAttendanceDto extends createZodDto(createAttendanceInput) {}
class CloseDayDto extends createZodDto(closeDayInput) {}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @RequirePermission('attendance.self')
  @Get('today')
  async today(@CurrentAuth() auth: AuthContext): Promise<DataResponse<MyAttendanceToday>> {
    return { data: await this.attendance.myToday(auth) };
  }

  @RequirePermission('attendance.self')
  @NoAudit('A check-in is itself a permanent record (attendance_records); corrections are audited')
  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  async checkIn(@CurrentAuth() auth: AuthContext, @Req() req: Request): Promise<DataResponse<MyAttendanceToday>> {
    return { data: await this.attendance.checkIn(auth, req.ip) };
  }

  @RequirePermission('attendance.self')
  @NoAudit('A check-out is itself a permanent record (attendance_records); corrections are audited')
  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  async checkOut(@CurrentAuth() auth: AuthContext, @Req() req: Request): Promise<DataResponse<MyAttendanceToday>> {
    return { data: await this.attendance.checkOut(auth, req.ip) };
  }

  @RequirePermission('attendance.view')
  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: AttendanceListQueryDto): Promise<ListResponse<AttendanceItem>> {
    return this.attendance.list(auth, query);
  }

  @RequirePermission('attendance.view')
  @Get('summary')
  async summary(@CurrentAuth() auth: AuthContext, @Query() query: AttendanceSummaryQueryDto): Promise<DataResponse<AttendanceSummary>> {
    return { data: await this.attendance.summary(auth, query) };
  }

  @RequirePermission('attendance.manage')
  @Post()
  async create(@CurrentAuth() auth: AuthContext, @Body() body: CreateAttendanceDto): Promise<DataResponse<AttendanceItem>> {
    return { data: await this.attendance.create(auth, body) };
  }

  @RequirePermission('attendance.manage')
  @Post('close-day')
  @HttpCode(HttpStatus.OK)
  async closeDay(@Body() body: CloseDayDto): Promise<DataResponse<{ date: string; created: number; missingCheckOuts: number }>> {
    return { data: await this.attendance.closeDayManually(body.date) };
  }

  @RequirePermission('attendance.manage')
  @Patch(':id')
  async correct(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: CorrectAttendanceDto): Promise<DataResponse<AttendanceItem>> {
    return { data: await this.attendance.correct(auth, id, body) };
  }
}

/**
 * Closes finished days every 10 minutes (plan §7's 23:55 close, made robust): days close from 23:55 in
 * the organization's time zone, which can change in settings, and days missed while the server was
 * down are caught up. Closing is idempotent, so overlapping runs or several instances are harmless.
 */
@Injectable()
export class AttendanceScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(AttendanceScheduler.name);
  private running = false;

  constructor(
    private readonly attendance: AttendanceService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** Catch up at start-up rather than waiting for the first 10-minute tick. */
  onApplicationBootstrap(): void {
    void this.closePendingDays();
  }

  @Interval('close-attendance-days', 10 * 60 * 1000)
  async closePendingDays(): Promise<void> {
    if (!this.config.JOBS_ENABLED || this.running) return;
    this.running = true;
    try {
      await this.attendance.closePendingDays();
    } catch (error) {
      this.logger.error({ err: error }, 'Closing attendance days failed; the next run retries');
    } finally {
      this.running = false;
    }
  }
}

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceIngestService, AttendanceScheduler],
  exports: [AttendanceIngestService],
})
export class AttendanceModule {}
