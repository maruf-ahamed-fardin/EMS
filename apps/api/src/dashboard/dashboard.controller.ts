import { Controller, Get, Module, Query } from '@nestjs/common';
import {
  type AttendanceTrend,
  attendanceTrendQuery,
  type DashboardOverview,
  type DataResponse,
  type SearchResults,
  searchQuery,
} from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { DashboardService } from './dashboard.service';
import { SearchService } from './search.service';

class AttendanceTrendQueryDto extends createZodDto(attendanceTrendQuery) {}
class SearchQueryDto extends createZodDto(searchQuery) {}

@Controller()
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly searchService: SearchService,
  ) {}

  /** Every signed-in user gets a dashboard; its variant and numbers follow their scope. */
  @Get('dashboard/overview')
  async overview(@CurrentAuth() auth: AuthContext): Promise<DataResponse<DashboardOverview>> {
    return { data: await this.dashboard.overview(auth) };
  }

  /** Needs attendance.view at TEAM or ALL. */
  @Get('dashboard/attendance-trend')
  async trend(@CurrentAuth() auth: AuthContext, @Query() query: AttendanceTrendQueryDto): Promise<DataResponse<AttendanceTrend>> {
    return { data: await this.dashboard.trend(auth, query.range) };
  }

  @Get('search')
  async search(@CurrentAuth() auth: AuthContext, @Query() query: SearchQueryDto): Promise<DataResponse<SearchResults>> {
    return { data: await this.searchService.search(auth, query.q) };
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, SearchService],
})
export class DashboardModule {}
