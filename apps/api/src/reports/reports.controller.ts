import { Controller, Get, Module, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { REPORT_KEYS, type ReportKey } from '@ems/contracts';
import type { Response } from 'express';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * `?format=json` (the default) is the paginated preview; `csv`, `xlsx` and `pdf` download the whole
   * report and also need `report.export`. Filters depend on the report (see `REPORT_QUERIES`).
   */
  @RequirePermission('report.view')
  @Get(':report')
  async run(@CurrentAuth() auth: AuthContext, @Param('report') report: string, @Query() query: Record<string, unknown>, @Res() res: Response): Promise<void> {
    if (!(REPORT_KEYS as readonly string[]).includes(report)) throw new NotFoundException();
    const key = report as ReportKey;
    const ctx = await this.reports.context(key, auth, query);
    if (ctx.query.format === 'json') {
      res.json(await this.reports.preview(key, ctx));
      return;
    }
    await this.reports.export(key, ctx, res);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
