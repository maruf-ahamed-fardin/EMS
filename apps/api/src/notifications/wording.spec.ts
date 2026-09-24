import { attendanceIssues, dateRange, days, shortDate } from './wording';

describe('notification wording', () => {
  it('writes dates and ranges briefly', () => {
    expect(shortDate('2026-09-04')).toBe('4 Sep');
    expect(dateRange('2026-09-24', '2026-09-24')).toBe('24 Sep');
    expect(dateRange('2026-09-22', '2026-09-24')).toBe('22–24 Sep');
    expect(dateRange('2026-09-30', '2026-10-02')).toBe('30 Sep – 2 Oct');
    expect(days(1)).toBe('1 day');
    expect(days(2.5)).toBe('2.5 days');
  });

  it('sums up attendance issues, and says nothing when there are none', () => {
    expect(attendanceIssues(3, 1)).toBe('3 people were absent and 1 didn’t check out');
    expect(attendanceIssues(1, 0)).toBe('1 person was absent');
    expect(attendanceIssues(0, 2)).toBe('2 didn’t check out');
    expect(attendanceIssues(0, 0)).toBe('');
  });
});
