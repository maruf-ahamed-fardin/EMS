import { DEFAULT_ATTENDANCE_SETTINGS } from '@ems/contracts';
import {
  addDays,
  daysBetween,
  isWorkingDay,
  lateAfter,
  monthStart,
  workingDaysUpTo,
  zonedDate,
  zonedHour,
  zonedTime,
} from './work-calendar';

const DHAKA = 'Asia/Dhaka';

describe('work calendar', () => {
  it('knows which day it is in Dhaka around UTC midnight', () => {
    // 18:30 UTC is 00:30 the next day in Dhaka (UTC+6)
    expect(zonedDate(new Date('2026-09-17T18:30:00Z'), DHAKA)).toBe('2026-09-18');
    expect(zonedDate(new Date('2026-09-17T17:59:00Z'), DHAKA)).toBe('2026-09-17');
    expect(zonedHour(new Date('2026-09-17T03:05:00Z'), DHAKA)).toBe(9);
  });

  it('turns a Dhaka wall-clock time into the right instant', () => {
    expect(zonedTime('2026-09-17', '09:15', DHAKA).toISOString()).toBe('2026-09-17T03:15:00.000Z');
    // A zone with daylight saving works the same way
    expect(zonedTime('2026-07-01', '09:00', 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-09-10', '2026-09-17')).toBe(7);
    expect(monthStart('2026-09-17')).toBe('2026-09-01');
  });

  it('treats Friday and holidays as non-working days by default', () => {
    expect(isWorkingDay('2026-09-18', DEFAULT_ATTENDANCE_SETTINGS, new Set())).toBe(false); // Friday
    expect(isWorkingDay('2026-09-17', DEFAULT_ATTENDANCE_SETTINGS, new Set())).toBe(true); // Thursday
    expect(isWorkingDay('2026-12-16', DEFAULT_ATTENDANCE_SETTINGS, new Set(['2026-12-16']))).toBe(false);
  });

  it('lists the last working days, oldest first, skipping weekends and holidays', () => {
    expect(workingDaysUpTo('2026-09-20', 4, DEFAULT_ATTENDANCE_SETTINGS, new Set(['2026-09-16']))).toEqual([
      '2026-09-15',
      '2026-09-17',
      '2026-09-19',
      '2026-09-20',
    ]);
  });

  it('computes the late threshold from start time and grace', () => {
    expect(lateAfter(DEFAULT_ATTENDANCE_SETTINGS)).toBe('09:15');
    expect(lateAfter({ workdayStart: '08:50', graceMinutes: 20 })).toBe('09:10');
  });
});
