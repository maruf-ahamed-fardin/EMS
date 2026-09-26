import { actionLabel, auditHref, entityHref, entityTypeLabel, fieldLabel, formatValue } from '@/lib/client/audit';

describe('audit helpers', () => {
  it('describes actions and record types in words, falling back to the raw name', () => {
    expect(actionLabel('employee.updated')).toBe('Edited an employee');
    expect(actionLabel('something.new')).toBe('something.new');
    expect(entityTypeLabel('leave_request')).toBe('Leave requests');
  });

  it('links records that have a page of their own', () => {
    expect(entityHref('employee', 'e1')).toBe('/employees/e1');
    expect(entityHref('department', 'd1')).toBe('/departments/d1');
    expect(entityHref('leave_type', 't1')).toBe('/leave/types');
    expect(entityHref('report', null)).toBeNull();
    expect(entityHref('leave_request', 'r1')).toBeNull();
  });

  it('turns field names into words', () => {
    expect(fieldLabel('emergencyContact')).toBe('emergency contact');
    expect(fieldLabel('departmentId')).toBe('department');
    expect(fieldLabel('phone')).toBe('phone');
  });

  it('formats values, nested ones as lines', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue([5, 6])).toBe('5, 6');
    expect(formatValue({ line1: 'House 7', line2: '', city: 'Dhaka' })).toBe('line1: House 7\ncity: Dhaka');
    expect(formatValue(18)).toBe('18');
  });

  it('keeps filters in the URL and resets the page when one changes', () => {
    expect(auditHref({ action: 'auth.login', page: '4' }, { from: '2026-09-01' })).toBe('/audit-logs?action=auth.login&from=2026-09-01');
    expect(auditHref({ action: 'auth.login' }, { page: '2' })).toBe('/audit-logs?action=auth.login&page=2');
    expect(auditHref({}, {})).toBe('/audit-logs');
  });
});
