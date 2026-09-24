import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { type AttendanceSettings, attendanceSettings, DEFAULT_ATTENDANCE_SETTINGS } from '@ems/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { dateOnly, zonedDate } from './work-calendar';

const SETTINGS_TTL_MS = 60_000;

/**
 * The organization's working calendar: attendance settings (from the `settings` table, with the plan
 * D6 defaults until someone edits them in Phase 6) and holidays.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private cached: { value: AttendanceSettings; expires: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async settings(): Promise<AttendanceSettings> {
    if (this.cached && this.cached.expires > Date.now()) return this.cached.value;
    const row = await this.prisma.setting.findUnique({ where: { key: 'attendance' }, select: { value: true } });
    const parsed = attendanceSettings.safeParse(row?.value ?? {});
    if (!parsed.success) this.logger.warn('Stored attendance settings are invalid; using defaults');
    const value = parsed.success ? parsed.data : DEFAULT_ATTENDANCE_SETTINGS;
    this.cached = { value, expires: Date.now() + SETTINGS_TTL_MS };
    return value;
  }

  /** Call after the attendance settings change. */
  invalidate(): void {
    this.cached = null;
  }

  async today(now = new Date()): Promise<string> {
    return zonedDate(now, (await this.settings()).timeZone);
  }

  /** Holidays in a range with their names, for explaining why a day doesn't count. */
  async holidayNamesBetween(from: string, to: string): Promise<Map<string, string>> {
    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: dateOnly(from), lte: dateOnly(to) } },
      select: { date: true, name: true },
    });
    return new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row.name]));
  }

  async holidaysBetween(from: string, to: string): Promise<Set<string>> {
    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: dateOnly(from), lte: dateOnly(to) } },
      select: { date: true },
    });
    return new Set(rows.map((row) => row.date.toISOString().slice(0, 10)));
  }
}

@Global()
@Module({ providers: [CalendarService], exports: [CalendarService] })
export class CalendarModule {}
