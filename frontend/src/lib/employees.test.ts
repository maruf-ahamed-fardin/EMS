import { pageWindow } from '@/components/shared/pagination';
import { describeActivity, dhakaDateDaysAgo, employeesHref, formatDate, formatDateTime, formatPhone } from './employees';

describe('employeesHref', () => {
  it('changes one filter, keeps the others and returns to page 1', () => {
    expect(employeesHref({ q: 'rahim', status: 'ACTIVE', page: '3' }, { departmentId: 'd1' })).toBe(
      '/employees?q=rahim&status=ACTIVE&departmentId=d1',
    );
  });

  it('keeps the page when the page is what changes', () => {
    expect(employeesHref({ q: 'rahim' }, { page: '2' })).toBe('/employees?q=rahim&page=2');
  });

  it('drops cleared filters', () => {
    expect(employeesHref({ status: 'ACTIVE' }, { status: undefined })).toBe('/employees');
  });
});

describe('formatting', () => {
  it('shows calendar dates without shifting a day', () => {
    expect(formatDate('2026-09-21')).toBe('21 Sep 2026');
  });

  it('formats Bangladeshi mobile numbers and leaves others alone', () => {
    expect(formatPhone('+8801711204318')).toBe('+880 1711-204318');
    expect(formatPhone('+442071234567')).toBe('+442071234567');
  });

  it('computes dates in Dhaka, which is ahead of UTC', () => {
    expect(dhakaDateDaysAgo(0, new Date('2026-09-17T20:00:00Z'))).toBe('2026-09-18');
    expect(dhakaDateDaysAgo(30, new Date('2026-09-17T06:00:00Z'))).toBe('2026-08-18');
  });
});

describe('describeActivity', () => {
  it('names the changed fields in plain words', () => {
    expect(describeActivity('employee.updated', ['phone', 'workLocation'])).toBe('updated phone and work location');
    expect(describeActivity('employee.updated', ['departmentId', 'managerId', 'positionId'])).toBe(
      'updated department, manager and position',
    );
  });

  it('describes status changes and unknown actions', () => {
    expect(describeActivity('employee.deactivated', ['status'])).toBe('deactivated the employee');
    expect(describeActivity('employee.photo_changed', [])).toBe('photo changed');
  });
});

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('shows first, last and neighbours with gaps', () => {
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, 'gap', 12]);
  });
});

describe('formatDateTime', () => {
  it('shows the instant in Dhaka time', () => {
    expect(formatDateTime('2026-09-21T03:03:00Z')).toBe('21 Sep 2026, 09:03');
    expect(formatDateTime('2026-12-31T19:30:00Z')).toBe('1 Jan 2027, 01:30');
  });
});
