import { Injectable } from '@nestjs/common';
import type { PunchInput } from '@ems/contracts';
import { CalendarService } from '../calendar/calendar.service';
import { dateOnly, isWorkingDay, zonedDate } from '../calendar/work-calendar';
import { conflict } from '../common/errors/http-errors';
import { DashboardCache } from '../dashboard/dashboard-cache';
import { PrismaService } from '../prisma/prisma.service';
import { checkInStatus, workedMinutes } from './attendance-rules';
import { lockEmployeeLeave } from '../leave/leave-ledger';

export interface PunchResult {
  attendanceId: string;
  workDate: string;
}

/**
 * Records one punch (plan §1, §7). The web check-in calls this, and so will mobile, biometric and RFID
 * sources later: every source gets the same rules. The time is always the server's (or the device's
 * trusted clock), never a time typed by the person checking in.
 */
@Injectable()
export class AttendanceIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
    private readonly dashboardCache: DashboardCache,
  ) {}

  async recordPunch(punch: PunchInput & { createdById?: string | null }): Promise<PunchResult> {
    const settings = await this.calendar.settings();
    const workDate = zonedDate(punch.occurredAt, settings.timeZone);
    const day = dateOnly(workDate);

    const employee = await this.prisma.employee.findFirst({
      where: { id: punch.employeeId, deletedAt: null },
      select: { status: true },
    });
    if (!employee || employee.status !== 'ACTIVE') throw conflict('Only active employees can check in or out');

    const result =
      punch.type === 'CHECK_IN'
        ? await this.checkIn(punch, workDate, day, settings)
        : await this.checkOut(punch, workDate, day);
    this.dashboardCache.invalidate();
    return result;
  }

  private async checkIn(punch: PunchInput & { createdById?: string | null }, workDate: string, day: Date, settings: Awaited<ReturnType<CalendarService['settings']>>) {
    const holidays = await this.calendar.holidaysBetween(workDate, workDate);
    const { status, lateMinutes } = checkInStatus(punch.occurredAt, workDate, settings, isWorkingDay(workDate, settings, holidays));

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Under the same lock as leave approval, so a check-in and an approval for today can't both land
        await lockEmployeeLeave(tx, punch.employeeId);
        const onLeave = await tx.leaveRequest.count({
          where: { employeeId: punch.employeeId, status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } },
        });
        if (onLeave > 0) throw conflict("You're on approved leave today, so you can't check in");

        const existing = await tx.attendance.findUnique({
          where: { employeeId_workDate: { employeeId: punch.employeeId, workDate: day } },
          select: { id: true, firstInAt: true },
        });
        if (existing?.firstInAt) throw conflict('You have already checked in today');

        const data = { firstInAt: punch.occurredAt, status, lateMinutes, sourceSummary: punch.source };
        // A row can exist without a check-in when a day was closed or corrected as absent
        const attendance = existing
          ? await tx.attendance.update({ where: { id: existing.id }, data, select: { id: true } })
          : await tx.attendance.create({ data: { employeeId: punch.employeeId, workDate: day, ...data }, select: { id: true } });
        await tx.attendanceRecord.create({
          data: {
            attendanceId: attendance.id,
            employeeId: punch.employeeId,
            type: 'CHECK_IN',
            occurredAt: punch.occurredAt,
            source: punch.source,
            deviceId: punch.deviceId ?? null,
            ip: punch.ip ?? null,
            createdById: punch.createdById ?? null,
          },
        });
        return { attendanceId: attendance.id, workDate };
      });
    } catch (error) {
      // Two check-ins racing each other: the unique (employee, day) index lets only one create the row
      if ((error as { code?: string }).code === 'P2002') throw conflict('You have already checked in today');
      throw error;
    }
  }

  private async checkOut(punch: PunchInput & { createdById?: string | null }, workDate: string, day: Date) {
    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.findUnique({
        where: { employeeId_workDate: { employeeId: punch.employeeId, workDate: day } },
        select: { id: true, firstInAt: true, lastOutAt: true },
      });
      if (!attendance?.firstInAt) throw conflict("You haven't checked in today");
      if (attendance.lastOutAt) throw conflict('You have already checked out today');
      if (punch.occurredAt <= attendance.firstInAt) throw conflict('Check-out must be after check-in');

      // Conditional update, so two check-outs at once can't both land
      const updated = await tx.attendance.updateMany({
        where: { id: attendance.id, lastOutAt: null },
        data: { lastOutAt: punch.occurredAt, workedMinutes: workedMinutes(attendance.firstInAt, punch.occurredAt) },
      });
      if (updated.count !== 1) throw conflict('You have already checked out today');

      await tx.attendanceRecord.create({
        data: {
          attendanceId: attendance.id,
          employeeId: punch.employeeId,
          type: 'CHECK_OUT',
          occurredAt: punch.occurredAt,
          source: punch.source,
          deviceId: punch.deviceId ?? null,
          ip: punch.ip ?? null,
          createdById: punch.createdById ?? null,
        },
      });
      return { attendanceId: attendance.id, workDate };
    });
  }
}
