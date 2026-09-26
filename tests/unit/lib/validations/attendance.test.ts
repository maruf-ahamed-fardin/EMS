import { describe, expect, it } from 'vitest';
import { attendanceListQuery, correctAttendanceInput, updateAttendanceSettingsInput } from '@/lib/validations/attendance';

describe('attendance corrections', () => {
  it('needs a reason and times in order', () => {
    expect(correctAttendanceInput.safeParse({ firstIn: '09:05', lastOut: '17:30', note: 'Forgot to check out' }).success).toBe(true);
    expect(correctAttendanceInput.safeParse({ firstIn: '09:05', lastOut: '17:30', note: '' }).error?.issues[0]?.path).toEqual(['note']);
    expect(correctAttendanceInput.safeParse({ firstIn: '18:00', lastOut: '09:00', note: 'Swap' }).error?.issues[0]?.message).toBe(
      'Check-out must be after check-in',
    );
    expect(correctAttendanceInput.safeParse({ firstIn: null, lastOut: '17:00', note: 'Only out' }).error?.issues[0]?.path).toEqual(['firstIn']);
  });

  it('rejects impossible clock times', () => {
    expect(correctAttendanceInput.safeParse({ firstIn: '24:00', lastOut: null, note: 'Late night' }).success).toBe(false);
  });
});

describe('attendance settings', () => {
  it('accepts real time zones only', () => {
    expect(updateAttendanceSettingsInput.safeParse({ timeZone: 'Asia/Dhaka' }).success).toBe(true);
    expect(updateAttendanceSettingsInput.safeParse({ timeZone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('keeps at least one working day and no duplicates', () => {
    expect(updateAttendanceSettingsInput.safeParse({ weekendDays: [0, 1, 2, 3, 4, 5, 6] }).success).toBe(false);
    expect(updateAttendanceSettingsInput.safeParse({ weekendDays: [5, 5] }).success).toBe(false);
    expect(updateAttendanceSettingsInput.safeParse({ weekendDays: [5, 6] }).success).toBe(true);
  });
});

describe('attendanceListQuery', () => {
  it('ignores junk filters', () => {
    expect(attendanceListQuery.parse({ from: 'yesterday', status: 'NAPPING', employeeId: '' })).toMatchObject({ from: undefined, status: undefined, employeeId: undefined });
  });
});
