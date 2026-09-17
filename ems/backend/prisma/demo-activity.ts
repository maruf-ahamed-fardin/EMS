import { type AttendanceSettings, DEFAULT_ATTENDANCE_SETTINGS } from '@ems/contracts';
import { checkInStatus, workedMinutes } from '../src/attendance/attendance-rules';
import { addDays, dateOnly, workingDaysUpTo, zonedDate, zonedTime } from '../src/calendar/work-calendar';
import type { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_DOMAIN } from './demo-data';

const LEAVE_TYPES = [
  { code: 'ANNUAL', name: 'Annual', defaultDaysPerYear: 18, carryForwardMax: 5, isPaid: true },
  { code: 'SICK', name: 'Sick', defaultDaysPerYear: 14, carryForwardMax: 0, isPaid: true },
  { code: 'CASUAL', name: 'Casual', defaultDaysPerYear: 10, carryForwardMax: 0, isPaid: true },
  { code: 'UNPAID', name: 'Unpaid', defaultDaysPerYear: 0, carryForwardMax: 0, isPaid: false },
] as const;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Leave {
  employeeId: string;
  typeCode: string;
  days: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  requestedDaysAgo: number;
}

/**
 * Demo attendance and leave (plan §14): leave types, this year's balances, a mix of approved, pending
 * and rejected requests (a few covering today), and 60 working days of attendance with realistic late
 * and absent rates, up to "now" today.
 *
 * Development data only. It replaces the attendance and leave of demo employees (@demo.selorax.test)
 * each time it runs, so the numbers always match the day it was run. The rules that decide "late" and
 * "absent" are the Phase 6 defaults; Phases 6 and 7 build the real flows.
 */
export async function seedDemoActivity(prisma: PrismaClient, now = new Date(), settings: AttendanceSettings = DEFAULT_ATTENDANCE_SETTINGS) {
  const tz = settings.timeZone;
  const today = zonedDate(now, tz);
  const year = Number(today.slice(0, 4));
  const random = mulberry32(Number(today.replaceAll('-', '')));
  const holidays = new Set<string>();

  const leaveTypes = new Map<string, { id: string; allocation: number; isPaid: boolean }>();
  for (const type of LEAVE_TYPES) {
    const existing = await prisma.leaveType.findFirst({ where: { code: type.code, deletedAt: null }, select: { id: true } });
    const row = existing
      ? await prisma.leaveType.update({ where: { id: existing.id }, data: type, select: { id: true } })
      : await prisma.leaveType.create({ data: type, select: { id: true } });
    leaveTypes.set(type.code, { id: row.id, allocation: type.defaultDaysPerYear, isPaid: type.isPaid });
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true, status: true, joiningDate: true, employeeCode: true },
    orderBy: { employeeCode: 'asc' },
  });
  const demoIds = employees.map((e) => e.id);

  // Start clean for demo employees only
  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { employeeId: { in: demoIds } } }),
    prisma.attendance.deleteMany({ where: { employeeId: { in: demoIds } } }),
    prisma.leaveRequest.deleteMany({ where: { employeeId: { in: demoIds } } }),
    prisma.leaveBalance.deleteMany({ where: { employeeId: { in: demoIds } } }),
  ]);

  const pastDays = workingDaysUpTo(addDays(today, -1), 60, settings, holidays);
  const futureDays = workingDaysUpTo(addDays(today, 30), 26, settings, holidays).filter((d) => d > today);
  const active = employees.filter((e) => e.status === 'ACTIVE');

  // ─── Leave ────────────────────────────────────────────────────────────────────────────────────
  const leaves: Leave[] = [];
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const span = (days: readonly string[], start: number, length: number) => days.slice(start, start + length);

  active.forEach((employee, index) => {
    // About half took some approved leave in the last 60 working days
    if (random() < 0.5) {
      const start = Math.floor(random() * (pastDays.length - 3));
      const type = random() < 0.6 ? 'ANNUAL' : random() < 0.6 ? 'SICK' : 'CASUAL';
      leaves.push({ employeeId: employee.id, typeCode: type, days: span(pastDays, start, 1 + Math.floor(random() * 3)), status: 'APPROVED', reason: type === 'SICK' ? 'Unwell' : 'Family visit', requestedDaysAgo: 70 - start });
    }
    // Every 7th person asks for upcoming leave that is still waiting for a decision
    if (index % 7 === 3) {
      const start = Math.floor(random() * Math.max(futureDays.length - 3, 1));
      leaves.push({ employeeId: employee.id, typeCode: pick(['ANNUAL', 'CASUAL'] as const), days: span(futureDays, start, 1 + Math.floor(random() * 3)), status: 'PENDING', reason: 'Personal errands', requestedDaysAgo: 1 + Math.floor(random() * 4) });
    }
    // A few rejected requests, and a few people on leave today
    if (index % 11 === 5) {
      leaves.push({ employeeId: employee.id, typeCode: 'ANNUAL', days: span(futureDays, 2, 2), status: 'REJECTED', reason: 'Trip', requestedDaysAgo: 6 });
    }
    if (index % 15 === 7) {
      leaves.push({ employeeId: employee.id, typeCode: 'SICK', days: [addDays(today, 0)], status: 'APPROVED', reason: 'Doctor appointment', requestedDaysAgo: 2 });
    }
  });

  const onLeaveOn = new Map<string, Set<string>>();
  for (const leave of leaves) {
    if (leave.status !== 'APPROVED') continue;
    for (const day of leave.days) {
      if (!onLeaveOn.has(leave.employeeId)) onLeaveOn.set(leave.employeeId, new Set());
      onLeaveOn.get(leave.employeeId)!.add(day);
    }
  }

  // Balances: allocation, minus used (approved) and pending days
  const balanceRows = active.flatMap((employee) =>
    [...leaveTypes.entries()].filter(([, type]) => type.isPaid).map(([code, type]) => {
      const mine = leaves.filter((l) => l.employeeId === employee.id && l.typeCode === code);
      const used = mine.filter((l) => l.status === 'APPROVED').reduce((sum, l) => sum + l.days.length, 0);
      const pending = mine.filter((l) => l.status === 'PENDING').reduce((sum, l) => sum + l.days.length, 0);
      return { employeeId: employee.id, leaveTypeId: type.id, year, allocated: Math.max(type.allocation, used + pending) };
    }),
  );
  await prisma.leaveBalance.createMany({ data: balanceRows });
  for (const leave of leaves) {
    const type = leaveTypes.get(leave.typeCode)!;
    if (leave.status === 'APPROVED' || leave.status === 'PENDING') {
      await prisma.leaveBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: type.id, year } },
        data: leave.status === 'APPROVED' ? { used: { increment: leave.days.length } } : { pending: { increment: leave.days.length } },
      });
    }
  }

  const hr = await prisma.user.findUnique({ where: { email: `hr@${DEMO_DOMAIN}` }, select: { id: true } });
  await prisma.leaveRequest.createMany({
    data: leaves
      .filter((l) => l.days.length > 0)
      .map((l) => {
        const requestedAt = new Date(now.getTime() - l.requestedDaysAgo * 86_400_000);
        return {
          employeeId: l.employeeId,
          leaveTypeId: leaveTypes.get(l.typeCode)!.id,
          startDate: dateOnly(l.days[0]!),
          endDate: dateOnly(l.days.at(-1)!),
          days: l.days.length,
          reason: l.reason,
          status: l.status,
          reviewedById: l.status === 'PENDING' ? null : (hr?.id ?? null),
          reviewedAt: l.status === 'PENDING' ? null : new Date(requestedAt.getTime() + 3_600_000),
          reviewNote: l.status === 'REJECTED' ? 'Too many people away that week' : null,
          createdAt: requestedAt,
        };
      }),
  });

  // ─── Attendance ───────────────────────────────────────────────────────────────────────────────
  let attendanceCount = 0;
  for (const day of [...pastDays, today]) {
    const isToday = day === today;
    const attendances: Array<{
      employeeId: string;
      workDate: Date;
      status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
      firstInAt: Date | null;
      lastOutAt: Date | null;
      workedMinutes: number;
      lateMinutes: number;
      sourceSummary: string | null;
    }> = [];

    for (const employee of active) {
      if (employee.joiningDate.toISOString().slice(0, 10) > day) continue;
      if (onLeaveOn.get(employee.id)?.has(day)) {
        if (!isToday) attendances.push({ employeeId: employee.id, workDate: dateOnly(day), status: 'ON_LEAVE', firstInAt: null, lastOutAt: null, workedMinutes: 0, lateMinutes: 0, sourceSummary: null });
        continue;
      }
      const roll = random();
      // Today, the ~10% who haven't come in yet simply have no row (absence is settled after the day)
      if (roll < (isToday ? 0.1 : 0.05)) {
        if (!isToday) attendances.push({ employeeId: employee.id, workDate: dateOnly(day), status: 'ABSENT', firstInAt: null, lastOutAt: null, workedMinutes: 0, lateMinutes: 0, sourceSummary: null });
        continue;
      }
      // Arrival between 08:30 and 09:15 mostly; about one in six arrives late, up to an hour
      const lateArrival = random() < 0.16;
      const minutesAfterStart = lateArrival ? 16 + Math.floor(random() * 50) : -30 + Math.floor(random() * 46);
      const firstInAt = new Date(zonedTime(day, settings.workdayStart, tz).getTime() + minutesAfterStart * 60_000);
      if (isToday && firstInAt > now) continue;
      const outCandidate = new Date(firstInAt.getTime() + (8 * 60 + Math.floor(random() * 90)) * 60_000);
      const lastOutAt = isToday && outCandidate > now ? null : outCandidate;
      // The same rule the check-in API applies
      const { status, lateMinutes } = checkInStatus(firstInAt, day, settings, true);
      attendances.push({
        employeeId: employee.id,
        workDate: dateOnly(day),
        status,
        firstInAt,
        lastOutAt,
        workedMinutes: workedMinutes(firstInAt, lastOutAt),
        lateMinutes,
        sourceSummary: 'WEB',
      });
    }

    await prisma.attendance.createMany({ data: attendances });
    const rows = await prisma.attendance.findMany({
      where: { workDate: dateOnly(day), employeeId: { in: attendances.map((a) => a.employeeId) }, firstInAt: { not: null } },
      select: { id: true, employeeId: true, firstInAt: true, lastOutAt: true },
    });
    await prisma.attendanceRecord.createMany({
      data: rows.flatMap((row) => [
        { attendanceId: row.id, employeeId: row.employeeId, type: 'CHECK_IN' as const, occurredAt: row.firstInAt!, source: 'WEB' as const },
        ...(row.lastOutAt ? [{ attendanceId: row.id, employeeId: row.employeeId, type: 'CHECK_OUT' as const, occurredAt: row.lastOutAt, source: 'WEB' as const }] : []),
      ]),
    });
    attendanceCount += attendances.length;
  }

  return { leaveRequests: leaves.length, attendanceRows: attendanceCount, days: pastDays.length + 1 };
}
