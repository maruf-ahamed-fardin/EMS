import type { DashboardOverview } from '@/lib/validations';
import { activitySentence, greeting, headline, percent, relativeTime } from './dashboard';

function overview(overrides: Partial<DashboardOverview> & { a?: Partial<NonNullable<DashboardOverview['attendanceToday']>>; pending?: number }): DashboardOverview {
  const { a, pending, ...rest } = overrides;
  return {
    variant: 'organization',
    generatedAt: '2026-09-17T06:33:00Z',
    today: '2026-09-17',
    isWorkingDay: true,
    lateAfter: '09:15',
    headcount: { total: 60, joinedThisMonth: 2, byDepartment: [] },
    attendanceToday: { expected: 56, present: 49, onTime: 41, late: 8, onLeave: 4, notCheckedIn: 7, presentRate: 0.875, ...a },
    attention: { pendingLeaveRequests: pending ?? 3, oldestPendingDays: 2, notCheckedIn: a?.notCheckedIn ?? 7, documentsExpiringSoon: 0, withoutAccount: 56 },
    pendingLeave: [],
    outToday: null,
    newJoiners: [],
    activity: [],
    me: null,
    ...rest,
  };
}

const text = (parts: Array<{ text: string }>) => parts.map((p) => p.text).join('');

describe('headline', () => {
  it('says who is in, what is waiting and who is missing', () => {
    expect(text(headline(overview({})))).toBe("49 of 56 people are in today. 3 leave requests are waiting on you, and 7 people haven't checked in yet.");
  });

  it('emphasizes only the numbers', () => {
    expect(headline(overview({})).filter((p) => 'strong' in p && p.strong).map((p) => p.text)).toEqual(['49 of 56', '3 leave requests', '7 people']);
  });

  it('handles singulars and the quiet cases', () => {
    expect(text(headline(overview({ pending: 1, a: { notCheckedIn: 0 } })))).toBe('49 of 56 people are in today. 1 leave request is waiting on you.');
    expect(text(headline(overview({ pending: 0, a: { notCheckedIn: 1 } })))).toBe("49 of 56 people are in today. 1 person hasn't checked in yet.");
    expect(text(headline(overview({ pending: 0, a: { notCheckedIn: 0 } })))).toBe('49 of 56 people are in today. Nothing is waiting on you.');
  });

  it('does not count attendance on a day off', () => {
    expect(text(headline(overview({ isWorkingDay: false, pending: 2 })))).toBe('Today is not a working day, but 2 leave requests are waiting on you.');
    expect(text(headline(overview({ isWorkingDay: false, pending: 0 })))).toBe('Today is not a working day.');
  });

  it('is empty for the personal variant', () => {
    expect(headline(overview({ attendanceToday: null, attention: null }))).toEqual([]);
  });
});

describe('small helpers', () => {
  it('greets by the hour', () => {
    expect([greeting(8), greeting(13), greeting(19)]).toEqual(['Good morning', 'Good afternoon', 'Good evening']);
  });

  it('shows relative times, then dates', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    expect(relativeTime('2026-09-17T11:48:00Z', now)).toBe('12m');
    expect(relativeTime('2026-09-17T09:00:00Z', now)).toBe('3h');
    expect(relativeTime('2026-09-14T12:00:00Z', now)).toBe('3d');
    expect(relativeTime('2026-09-01T12:00:00Z', now)).toBe('1 Sep');
  });

  it('formats a share, and refuses to divide by zero', () => {
    expect(percent(49, 56)).toBe('87.5%');
    expect(percent(0, 0)).toBe('—');
  });

  it('describes activity about people and other things', () => {
    const base = { id: '1', actor: 'Farhana', entityType: 'employee', entityId: 'e1', createdAt: '2026-09-17T06:00:00Z' };
    expect(activitySentence({ ...base, action: 'employee.created', subject: { id: 'e1', name: 'Rahim Ahmed' } })).toBe('added Rahim Ahmed');
    expect(activitySentence({ ...base, action: 'department.deleted', entityType: 'department', subject: null })).toBe('deleted a department');
    expect(activitySentence({ ...base, action: 'leave.approved', entityType: 'leave_request', subject: null })).toBe('approved a leave');
  });
});
