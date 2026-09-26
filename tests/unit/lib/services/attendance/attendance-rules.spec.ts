import { DEFAULT_ATTENDANCE_SETTINGS } from '@/lib/validations';
import { checkInStatus, closingStatus, isClosable, workedMinutes } from '@/lib/services/attendance/attendance-rules';

const settings = DEFAULT_ATTENDANCE_SETTINGS; // Asia/Dhaka, 09:00 start, 15 minutes grace

describe('checkInStatus', () => {
  it('is on time up to and including the end of the grace period', () => {
    // 09:15 Dhaka = 03:15 UTC
    expect(checkInStatus(new Date('2026-09-17T03:15:00Z'), '2026-09-17', settings, true)).toEqual({ status: 'PRESENT', lateMinutes: 0 });
    expect(checkInStatus(new Date('2026-09-17T02:40:00Z'), '2026-09-17', settings, true)).toEqual({ status: 'PRESENT', lateMinutes: 0 });
  });

  it('is late after the grace period, counting minutes from the start of the day', () => {
    // 09:16 Dhaka: late, 16 minutes after 09:00
    expect(checkInStatus(new Date('2026-09-17T03:16:00Z'), '2026-09-17', settings, true)).toEqual({ status: 'LATE', lateMinutes: 16 });
  });

  it('is never late on a weekend or holiday', () => {
    expect(checkInStatus(new Date('2026-09-18T06:00:00Z'), '2026-09-18', settings, false)).toEqual({ status: 'PRESENT', lateMinutes: 0 });
  });

  it('follows the configured start time and grace', () => {
    const custom = { ...settings, workdayStart: '10:00', graceMinutes: 0 };
    expect(checkInStatus(new Date('2026-09-17T04:01:00Z'), '2026-09-17', custom, true)).toEqual({ status: 'LATE', lateMinutes: 1 });
  });
});

describe('workedMinutes', () => {
  it('counts only complete pairs', () => {
    expect(workedMinutes(new Date('2026-09-17T03:00:00Z'), new Date('2026-09-17T11:30:00Z'))).toBe(510);
    expect(workedMinutes(new Date('2026-09-17T03:00:00Z'), null)).toBe(0);
  });
});

describe('closingStatus', () => {
  it('prefers holiday, then weekend, then leave, then absent', () => {
    expect(closingStatus({ holiday: true, weekend: true, onLeave: true })).toBe('HOLIDAY');
    expect(closingStatus({ holiday: false, weekend: true, onLeave: true })).toBe('WEEKEND');
    expect(closingStatus({ holiday: false, weekend: false, onLeave: true })).toBe('ON_LEAVE');
    expect(closingStatus({ holiday: false, weekend: false, onLeave: false })).toBe('ABSENT');
  });
});

describe('isClosable', () => {
  it('closes past days at any time, and today only from 23:55 in Dhaka', () => {
    expect(isClosable('2026-09-16', new Date('2026-09-17T00:00:00Z'), 'Asia/Dhaka')).toBe(true);
    // 23:54 Dhaka on the 17th = 17:54 UTC
    expect(isClosable('2026-09-17', new Date('2026-09-17T17:54:00Z'), 'Asia/Dhaka')).toBe(false);
    expect(isClosable('2026-09-17', new Date('2026-09-17T17:55:00Z'), 'Asia/Dhaka')).toBe(true);
    expect(isClosable('2026-09-18', new Date('2026-09-17T17:55:00Z'), 'Asia/Dhaka')).toBe(false);
  });
});
