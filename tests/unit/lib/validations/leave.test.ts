import { describe, expect, it } from 'vitest';
import { adjustLeaveBalanceInput, createLeaveRequestInput, createLeaveTypeInput, rejectLeaveInput } from '@/lib/validations/leave';

describe('leave inputs', () => {
  const base = { leaveTypeId: '0192f0c3-0000-7000-8000-000000000001', startDate: '2026-09-22', endDate: '2026-09-24', reason: 'Family visit' };

  it('accepts a normal request', () => {
    expect(createLeaveRequestInput.safeParse(base).success).toBe(true);
  });

  it('refuses a range that ends first, or crosses a year', () => {
    expect(createLeaveRequestInput.safeParse({ ...base, endDate: '2026-09-21' }).error?.issues[0]?.path).toEqual(['endDate']);
    expect(createLeaveRequestInput.safeParse({ ...base, startDate: '2026-12-30', endDate: '2027-01-02' }).error?.issues[0]?.message).toMatch(/another year/);
  });

  it('allows half days in allowances but not other fractions', () => {
    expect(createLeaveTypeInput.parse({ name: 'Annual', code: 'annual', defaultDaysPerYear: '18.5' })).toMatchObject({ code: 'ANNUAL', defaultDaysPerYear: 18.5, carryForwardMax: 0, isPaid: true });
    expect(createLeaveTypeInput.safeParse({ name: 'Annual', code: 'ANNUAL', defaultDaysPerYear: 18.25 }).success).toBe(false);
  });

  it('needs a reason to reject and to adjust a balance', () => {
    expect(rejectLeaveInput.safeParse({ note: '' }).success).toBe(false);
    expect(adjustLeaveBalanceInput.safeParse({ allocated: 20, note: 'Long service' }).success).toBe(true);
    expect(adjustLeaveBalanceInput.safeParse({ note: 'Nothing changed' }).success).toBe(false);
  });
});
