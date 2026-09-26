import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type AttendanceSettings,
  createHolidayInput,
  type CreateHolidayInput,
  type DataResponse,
  type HolidayItem,
  holidayListQuery,
  updateAttendanceSettingsInput,
  type UpdateAttendanceSettingsInput,
} from '@/lib/validations';
import { createZodDto } from 'nestjs-zod';
import { AuditService } from '@/lib/services/audit/audit.service';
import { RequirePermission } from '@/lib/auth/decorators';
import { CalendarService } from '@/lib/services/calendar/calendar.service';
import { dateOnly } from '@/lib/services/calendar/work-calendar';
import { Clock } from '@/lib/http/clock';
import { conflict } from '@/lib/http/errors/http-errors';
import { PrismaService } from '@/lib/db/prisma';

class UpdateAttendanceSettingsDto extends createZodDto(updateAttendanceSettingsInput) {}
class CreateHolidayDto extends createZodDto(createHolidayInput) {}
class HolidayListQueryDto extends createZodDto(holidayListQuery) {}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  attendance(): Promise<AttendanceSettings> {
    return this.calendar.settings();
  }

  /**
   * Changes apply from now on. Existing attendance keeps the status it was given, because it was
   * correct under the rules at the time.
   */
  async updateAttendance(input: UpdateAttendanceSettingsInput): Promise<AttendanceSettings> {
    const before = await this.calendar.settings();
    const after = { ...before, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
    after.weekendDays = [...after.weekendDays].sort((a, b) => a - b);

    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: 'attendance' },
        create: { key: 'attendance', value: after },
        update: { value: after },
      });
      await this.audit.record({ action: 'settings.updated', entityType: 'setting', entityId: 'attendance', before: { ...before }, after: { ...after } }, tx);
    });
    this.calendar.invalidate();
    return this.calendar.settings();
  }

  async holidays(year?: number): Promise<HolidayItem[]> {
    const rows = await this.prisma.holiday.findMany({
      where: year ? { date: { gte: dateOnly(`${year}-01-01`), lte: dateOnly(`${year}-12-31`) } } : {},
      orderBy: { date: 'asc' },
      select: { id: true, date: true, name: true },
    });
    return rows.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), name: r.name }));
  }

  /**
   * A holiday added for a day that already closed turns that day's ABSENT rows into HOLIDAY, so nobody
   * keeps an absence for a day the office was shut.
   */
  async addHoliday(input: CreateHolidayInput): Promise<HolidayItem> {
    const today = await this.calendar.today(this.clock.now());
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const holiday = await tx.holiday.create({ data: { date: dateOnly(input.date), name: input.name }, select: { id: true, date: true, name: true } });
        const updated =
          input.date <= today
            ? await tx.attendance.updateMany({ where: { workDate: dateOnly(input.date), status: 'ABSENT', firstInAt: null }, data: { status: 'HOLIDAY' } })
            : { count: 0 };
        await this.audit.record({ action: 'holiday.created', entityType: 'holiday', entityId: holiday.id, after: { date: input.date, name: input.name, attendanceRowsUpdated: updated.count } }, tx);
        return holiday;
      });
      this.calendar.invalidate();
      return { id: row.id, date: input.date, name: row.name };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw conflict('That date is already a holiday', { date: 'That date is already a holiday' });
      throw error;
    }
  }

  /** Removing a past holiday turns its untouched HOLIDAY rows back into absences. */
  async removeHoliday(id: string): Promise<void> {
    const holiday = await this.prisma.holiday.findUnique({ where: { id }, select: { id: true, date: true, name: true } }).catch(() => null);
    if (!holiday) throw new NotFoundException();
    const date = holiday.date.toISOString().slice(0, 10);
    const today = await this.calendar.today(this.clock.now());
    await this.prisma.$transaction(async (tx) => {
      await tx.holiday.delete({ where: { id } });
      const updated =
        date <= today
          ? await tx.attendance.updateMany({ where: { workDate: holiday.date, status: 'HOLIDAY', firstInAt: null }, data: { status: 'ABSENT' } })
          : { count: 0 };
      await this.audit.record({ action: 'holiday.deleted', entityType: 'holiday', entityId: id, before: { date, name: holiday.name }, after: { attendanceRowsUpdated: updated.count } }, tx);
    });
    this.calendar.invalidate();
  }
}

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @RequirePermission('settings.manage')
  @Get('settings/attendance')
  async attendance(): Promise<DataResponse<AttendanceSettings>> {
    return { data: await this.settings.attendance() };
  }

  @RequirePermission('settings.manage')
  @Patch('settings/attendance')
  async updateAttendance(@Body() body: UpdateAttendanceSettingsDto): Promise<DataResponse<AttendanceSettings>> {
    return { data: await this.settings.updateAttendance(body) };
  }

  /** Everyone signed in may see the holiday calendar. */
  @Get('holidays')
  async holidays(@Query() query: HolidayListQueryDto): Promise<DataResponse<HolidayItem[]>> {
    return { data: await this.settings.holidays(query.year) };
  }

  @RequirePermission('settings.manage')
  @Post('holidays')
  async addHoliday(@Body() body: CreateHolidayDto): Promise<DataResponse<HolidayItem>> {
    return { data: await this.settings.addHoliday(body) };
  }

  @RequirePermission('settings.manage')
  @Delete('holidays/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeHoliday(@Param('id') id: string): Promise<void> {
    await this.settings.removeHoliday(id);
  }
}

@Module({ controllers: [SettingsController], providers: [SettingsService] })
export class SettingsModule {}
