import { ForbiddenException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { MAX_EXPORT_ROWS, pageMeta, REPORT_QUERIES, REPORT_TITLES, type ReportCell, type ReportFormat, type ReportKey, type ReportResponse } from '@/lib/validations';
import type { Response } from 'express';
import { AuditService } from '@/lib/services/audit/audit.service';
import type { AuthContext } from '@/lib/auth/auth-context';
import { ScopeService } from '@/lib/auth/scope.service';
import { CalendarService } from '@/lib/services/calendar/calendar.service';
import { Clock } from '@/lib/http/clock';
import { invalidFields } from '@/lib/http/errors/http-errors';
import { PrismaService } from '@/lib/db/prisma';
import { type ReportContext, REPORTS } from './definitions';
import { CsvWriter } from './writers/csv';
import { PdfWriter } from './writers/pdf';
import { type ReportWriter, Sink } from './writers/sink';
import { XlsxWriter } from './writers/xlsx';

/** Rows fetched per query while exporting: large enough to be quick, small enough to keep memory flat. */
export const EXPORT_BATCH = 2000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "19 Sep 2026, 14:32" in the organization's time zone. */
export function stamp(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

type Parsed = { format: ReportFormat; page: number; limit: number; from?: string; to?: string };

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly calendar: CalendarService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  /** Validates the filters and decides the scope: `report.view` to look, `report.export` for a file. */
  async context(key: ReportKey, auth: AuthContext, raw: Record<string, unknown>): Promise<ReportContext<Parsed>> {
    const parsed = REPORT_QUERIES[key].safeParse(raw);
    if (!parsed.success) throw invalidFields(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
    const query = parsed.data as Parsed;
    if (query.format !== 'json' && !auth.permissions['report.export']) throw new ForbiddenException('Your role can view reports but not export them');
    const { timeZone } = await this.calendar.settings();
    return { auth, scopeKey: query.format === 'json' ? 'report.view' : 'report.export', query, prisma: this.prisma, scope: this.scope, timeZone };
  }

  /** The JSON preview: one page of rows, with the columns, filters and totals. */
  async preview(key: ReportKey, ctx: ReportContext<Parsed>): Promise<ReportResponse> {
    const definition = REPORTS[key];
    const c = ctx as ReportContext<never>;
    const [total, rows, summary, filters] = await Promise.all([
      definition.count(c),
      definition.rows(c, (ctx.query.page - 1) * ctx.query.limit, ctx.query.limit),
      definition.summary(c),
      definition.describe(c),
    ]);
    return {
      title: REPORT_TITLES[key],
      filters,
      columns: definition.columns.map(({ key: k, label, numeric }) => ({ key: k, label, ...(numeric ? { numeric } : {}) })),
      data: rows.map((row) => Object.fromEntries(definition.columns.map((column, i) => [column.key, row[i] ?? null])) as Record<string, ReportCell>),
      meta: pageMeta(ctx.query.page, ctx.query.limit, total),
      summary,
    };
  }

  /**
   * Streams the report as a file (plan §10), batch by batch, waiting for the client when it reads
   * slowly. Over 50 000 rows is refused before anything is sent. Every export is audited.
   */
  async export(key: ReportKey, ctx: ReportContext<Parsed>, res: Response): Promise<void> {
    const definition = REPORTS[key];
    const c = ctx as ReportContext<never>;
    const format = ctx.query.format;
    const total = await definition.count(c);
    if (total > MAX_EXPORT_ROWS) {
      throw new PayloadTooLargeException(
        `This export would have ${total.toLocaleString('en-US')} rows; the limit is ${MAX_EXPORT_ROWS.toLocaleString('en-US')}. Narrow the date range or add a filter.`,
      );
    }
    const [summary, filters] = await Promise.all([definition.summary(c), definition.describe(c)]);
    await this.audit.record({ action: 'report.exported', entityType: 'report', entityId: null, after: { report: key, format, filters, rows: total } });

    const sink = new Sink(res);
    const writer: ReportWriter = format === 'csv' ? new CsvWriter(sink) : format === 'xlsx' ? new XlsxWriter(sink) : new PdfWriter(sink);
    const today = await this.calendar.today(this.clock.now());
    const period = ctx.query.from && ctx.query.to ? `${ctx.query.from}-to-${ctx.query.to}` : today;
    res.status(200).set({
      'Content-Type': writer.contentType,
      'Content-Disposition': `attachment; filename="${key}-${period}.${writer.extension}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    try {
      await writer.start({ title: REPORT_TITLES[key], filters, generatedAt: stamp(this.clock.now(), ctx.timeZone), columns: definition.columns, summary });
      for (let skip = 0; skip < total; skip += EXPORT_BATCH) {
        const rows = await definition.rows(c, skip, EXPORT_BATCH);
        if (rows.length === 0) break;
        await writer.rows(rows);
      }
      await writer.end();
      if (!res.writableEnded) res.end();
    } catch (error) {
      // The headers are gone, so there is no error response to give; cut the download short instead
      this.logger.error({ err: error, report: key, format }, 'Report export failed while streaming');
      res.destroy();
    }
  }
}
