import { DEFAULT_ATTENDANCE_SETTINGS } from '@/lib/validations';
import { available, carryForward, countLeaveDays, proratedAllocation, roundDownToHalf } from '@/lib/services/leave/leave-rules';

describe('countLeaveDays', () => {
  it('skips Fridays and holidays, and names why', () => {
    // Thu 17 Sep … Mon 21 Sep 2026: Friday 18 is the weekend, Sunday 20 is a holiday
    const result = countLeaveDays('2026-09-17', '2026-09-21', DEFAULT_ATTENDANCE_SETTINGS, new Map([['2026-09-20', 'Office closed']]));
    expect(result.workingDays).toEqual(['2026-09-17', '2026-09-19', '2026-09-21']);
    expect(result.excludedDays).toEqual([
      { date: '2026-09-18', reason: 'Friday' },
      { date: '2026-09-20', reason: 'Office closed' },
    ]);
  });

  it('counts a single day and returns nothing for a day off', () => {
    expect(countLeaveDays('2026-09-17', '2026-09-17', DEFAULT_ATTENDANCE_SETTINGS, new Map()).workingDays).toHaveLength(1);
    expect(countLeaveDays('2026-09-18', '2026-09-18', DEFAULT_ATTENDANCE_SETTINGS, new Map()).workingDays).toHaveLength(0);
  });

  it('crosses month ends', () => {
    expect(countLeaveDays('2026-09-29', '2026-10-01', DEFAULT_ATTENDANCE_SETTINGS, new Map()).workingDays).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});

describe('proratedAllocation', () => {
  it('gives the full allowance to people who joined before the year', () => {
    expect(proratedAllocation(18, '2024-03-01', 2026)).toBe(18);
    expect(proratedAllocation(18, '2026-01-01', 2026)).toBe(18);
  });

  it('gives a share of the year to people who join during it, rounded down to half days', () => {
    // 1 July 2026: 184 of 365 days left → 18 × 184 / 365 = 9.07 → 9
    expect(proratedAllocation(18, '2026-07-01', 2026)).toBe(9);
    // 31 December: one day left → 0.049 → 0
    expect(proratedAllocation(18, '2026-12-31', 2026)).toBe(0);
  });

  it('gives nothing for a year before they join', () => {
    expect(proratedAllocation(18, '2027-02-01', 2026)).toBe(0);
  });
});

describe('carryForward and available', () => {
  const balance = { allocated: 18, carriedForward: 2, used: 10, pending: 3 };

  it('carries unused days up to the cap', () => {
    expect(carryForward(balance, 5)).toBe(5);
    expect(carryForward(balance, 10)).toBe(7);
    expect(carryForward(balance, 0)).toBe(0);
    expect(carryForward(null, 5)).toBe(0);
    expect(carryForward({ ...balance, used: 25 }, 5)).toBe(0);
  });

  it('counts pending days as spoken for', () => {
    expect(available(balance)).toBe(7);
    expect(roundDownToHalf(4.74)).toBe(4.5);
  });
});
