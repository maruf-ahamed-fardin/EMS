import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Injectable, Logger, Module, type OnApplicationBootstrap, Param, Patch, Post, Query } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  adjustLeaveBalanceInput,
  allocateYearInput,
  createLeaveRequestInput,
  createLeaveTypeInput,
  type DataResponse,
  type LeaveBalanceRow,
  leaveBalanceQuery,
  type LeavePreview,
  leavePreviewInput,
  type LeaveRequestItem,
  leaveRequestListQuery,
  type LeaveTypeItem,
  type ListResponse,
  rejectLeaveInput,
  reviewLeaveInput,
  updateLeaveTypeInput,
} from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { InjectConfig, type AppConfig } from '../config/config.module';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveTypesService } from './leave-types.service';

class LeaveRequestListQueryDto extends createZodDto(leaveRequestListQuery) {}
class LeavePreviewDto extends createZodDto(leavePreviewInput) {}
class CreateLeaveRequestDto extends createZodDto(createLeaveRequestInput) {}
class ReviewLeaveDto extends createZodDto(reviewLeaveInput) {}
class RejectLeaveDto extends createZodDto(rejectLeaveInput) {}
class LeaveBalanceQueryDto extends createZodDto(leaveBalanceQuery) {}
class AdjustLeaveBalanceDto extends createZodDto(adjustLeaveBalanceInput) {}
class AllocateYearDto extends createZodDto(allocateYearInput) {}
class CreateLeaveTypeDto extends createZodDto(createLeaveTypeInput) {}
class UpdateLeaveTypeDto extends createZodDto(updateLeaveTypeInput) {}
class LeaveTypeListQueryDto extends createZodDto(z.object({ includeInactive: z.enum(['true', 'false']).optional().transform((v) => v === 'true') })) {}

@Controller('leave')
export class LeaveController {
  constructor(
    private readonly requests: LeaveRequestsService,
    private readonly balances: LeaveBalancesService,
    private readonly types: LeaveTypesService,
  ) {}

  // ─── Requests ───────────────────────────────────────────────────────────────────────────────

  @RequirePermission('leave.create')
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(@CurrentAuth() auth: AuthContext, @Body() body: LeavePreviewDto): Promise<DataResponse<LeavePreview>> {
    return { data: await this.requests.preview(auth, body) };
  }

  @RequirePermission('leave.create')
  @Post('requests')
  async create(@CurrentAuth() auth: AuthContext, @Body() body: CreateLeaveRequestDto): Promise<DataResponse<LeaveRequestItem>> {
    return { data: await this.requests.create(auth, body) };
  }

  /** Everyone sees their own requests; leave.view adds the people in its scope. */
  @Get('requests')
  list(@CurrentAuth() auth: AuthContext, @Query() query: LeaveRequestListQueryDto): Promise<ListResponse<LeaveRequestItem>> {
    return this.requests.list(auth, query);
  }

  @Get('requests/:id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<LeaveRequestItem>> {
    return { data: await this.requests.get(auth, id) };
  }

  @RequirePermission('leave.approve')
  @Patch('requests/:id/approve')
  async approve(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: ReviewLeaveDto): Promise<DataResponse<LeaveRequestItem>> {
    return { data: await this.requests.approve(auth, id, body.note) };
  }

  @RequirePermission('leave.reject')
  @Patch('requests/:id/reject')
  async reject(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: RejectLeaveDto): Promise<DataResponse<LeaveRequestItem>> {
    return { data: await this.requests.reject(auth, id, body.note) };
  }

  @Patch('requests/:id/cancel')
  async cancel(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<LeaveRequestItem>> {
    return { data: await this.requests.cancel(auth, id) };
  }

  // ─── Balances ───────────────────────────────────────────────────────────────────────────────

  /** Your own balances without any permission; someone else's with leave.view in scope. */
  @Get('balances')
  async balancesList(@CurrentAuth() auth: AuthContext, @Query() query: LeaveBalanceQueryDto): Promise<DataResponse<LeaveBalanceRow[]>> {
    return { data: await this.balances.list(auth, query) };
  }

  @RequirePermission('leave.manage_balances')
  @Patch('balances/:id')
  async adjust(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: AdjustLeaveBalanceDto): Promise<DataResponse<LeaveBalanceRow>> {
    return { data: await this.balances.adjust(auth, id, body) };
  }

  /** Creates a year's balances by hand (the scheduler does it too). This year or next only. */
  @RequirePermission('leave.manage_balances', 'ALL')
  @Post('balances/allocate')
  @HttpCode(HttpStatus.OK)
  async allocate(@Body() body: AllocateYearDto): Promise<DataResponse<{ year: number; created: number }>> {
    const current = await this.balances.currentYear();
    if (body.year !== current && body.year !== current + 1) throw new ForbiddenException(`Balances can be created for ${current} or ${current + 1}`);
    return { data: { year: body.year, created: await this.balances.ensureYear(body.year) } };
  }

  // ─── Types ──────────────────────────────────────────────────────────────────────────────────

  /** Everyone can see the leave types they can request. */
  @Get('types')
  async typesList(@CurrentAuth() auth: AuthContext, @Query() query: LeaveTypeListQueryDto): Promise<DataResponse<LeaveTypeItem[]>> {
    const includeInactive = query.includeInactive && auth.permissions['leave.manage_types'] !== undefined;
    return { data: await this.types.list(includeInactive) };
  }

  @RequirePermission('leave.manage_types')
  @Post('types')
  async createType(@Body() body: CreateLeaveTypeDto): Promise<DataResponse<LeaveTypeItem>> {
    return { data: await this.types.create(body) };
  }

  @RequirePermission('leave.manage_types')
  @Patch('types/:id')
  async updateType(@Param('id') id: string, @Body() body: UpdateLeaveTypeDto): Promise<DataResponse<LeaveTypeItem>> {
    return { data: await this.types.update(id, body) };
  }

  @RequirePermission('leave.manage_types')
  @Delete('types/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeType(@Param('id') id: string): Promise<void> {
    await this.types.remove(id);
  }
}

/**
 * Keeps this year's balances complete (plan §7's 1 January allocation, made robust): at start-up and
 * every hour it creates any missing balances, so a new year, a new leave type or a reactivated
 * employee is covered without anyone running a job. Idempotent.
 */
@Injectable()
export class LeaveScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(LeaveScheduler.name);

  constructor(
    private readonly balances: LeaveBalancesService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    void this.ensureBalances();
  }

  @Interval('ensure-leave-balances', 60 * 60 * 1000)
  async ensureBalances(): Promise<void> {
    if (!this.config.JOBS_ENABLED) return;
    try {
      await this.balances.ensureYear(await this.balances.currentYear());
    } catch (error) {
      this.logger.error({ err: error }, 'Creating leave balances failed; the next run retries');
    }
  }
}

@Module({
  controllers: [LeaveController],
  providers: [LeaveRequestsService, LeaveBalancesService, LeaveTypesService, LeaveScheduler],
  exports: [LeaveBalancesService],
})
export class LeaveModule {}
