import { DEFAULT_ROLE_GRANTS } from '@ems/contracts';
import { activeItem, NAVIGATION, visibleNavigation } from './navigation';

const hrefsFor = (role: keyof typeof DEFAULT_ROLE_GRANTS) =>
  visibleNavigation(DEFAULT_ROLE_GRANTS[role]).flatMap((group) => group.items.map((item) => item.href));

describe('visibleNavigation', () => {
  it('shows Super Admin everything', () => {
    expect(hrefsFor('super_admin')).toEqual(NAVIGATION.flatMap((group) => group.items.map((item) => item.href)));
  });

  it('gives an employee the short menu', () => {
    expect(hrefsFor('employee')).toEqual([
      '/dashboard',
      '/departments',
      '/positions',
      '/attendance',
      '/leave',
      '/documents',
    ]);
  });

  it('shows a manager their team tools but no administration', () => {
    const hrefs = hrefsFor('manager');
    expect(hrefs).toEqual(expect.arrayContaining(['/employees', '/leave/requests', '/reports']));
    for (const admin of ['/users', '/roles', '/audit-logs', '/settings', '/leave/types']) {
      expect(hrefs).not.toContain(admin);
    }
  });

  it('keeps roles management away from HR', () => {
    expect(hrefsFor('hr_admin')).not.toContain('/roles');
    expect(hrefsFor('hr_admin')).toContain('/settings');
  });

  it('drops groups with nothing visible', () => {
    const groups = visibleNavigation(DEFAULT_ROLE_GRANTS.employee).map((group) => group.label);
    expect(groups).not.toContain('Administration');
    expect(groups).not.toContain('Insights');
  });

  it('hides Employees from someone who can only see their own record', () => {
    expect(hrefsFor('employee')).not.toContain('/employees');
  });
});

describe('activeItem', () => {
  const groups = visibleNavigation(DEFAULT_ROLE_GRANTS.super_admin);

  it('prefers the most specific match', () => {
    expect(activeItem(groups, '/leave/requests')?.label).toBe('Leave requests');
    expect(activeItem(groups, '/leave')?.label).toBe('Leave');
  });

  it('matches detail pages to their section', () => {
    expect(activeItem(groups, '/employees/0192f0c3-aaaa')?.label).toBe('Employees');
  });

  it('does not match on a shared prefix alone', () => {
    expect(activeItem(groups, '/leaves')).toBeUndefined();
  });
});
