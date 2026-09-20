import { describe, expect, it } from 'vitest';
import { can, DEFAULT_ROLE_GRANTS, isPermissionKey, PERMISSION_KEYS, pageMeta, SYSTEM_ROLES } from './index';

describe('permission catalogue', () => {
  it('uses module.action keys', () => {
    for (const key of PERMISSION_KEYS) expect(key).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('only grants keys that exist', () => {
    for (const grants of Object.values(DEFAULT_ROLE_GRANTS)) {
      for (const key of Object.keys(grants)) expect(isPermissionKey(key)).toBe(true);
    }
  });

  it('has a grant set for every system role', () => {
    expect(Object.keys(DEFAULT_ROLE_GRANTS).sort()).toEqual(Object.keys(SYSTEM_ROLES).sort());
  });

  it('keeps role and user management with Super Admin only', () => {
    expect(DEFAULT_ROLE_GRANTS.super_admin['role.manage']).toBe('ALL');
    for (const role of ['hr_admin', 'manager', 'employee'] as const) {
      expect(DEFAULT_ROLE_GRANTS[role]['role.manage']).toBeUndefined();
      expect(DEFAULT_ROLE_GRANTS[role]['user.manage']).toBeUndefined();
    }
  });

  it('never lets a manager or employee change settings', () => {
    expect(DEFAULT_ROLE_GRANTS.manager['settings.manage']).toBeUndefined();
    expect(DEFAULT_ROLE_GRANTS.employee['settings.manage']).toBeUndefined();
  });

  it('keeps private employee fields away from managers (assumption 11)', () => {
    expect(DEFAULT_ROLE_GRANTS.manager['employee.view_private']).toBeUndefined();
  });
});

describe('can', () => {
  const map = { 'employee.view': 'TEAM', 'leave.create': 'ALL' } as const;

  it('compares scope by reach', () => {
    expect(can(map, 'employee.view')).toBe(true);
    expect(can(map, 'employee.view', 'TEAM')).toBe(true);
    expect(can(map, 'employee.view', 'ALL')).toBe(false);
  });

  it('denies what is not granted', () => {
    expect(can(map, 'audit.view')).toBe(false);
  });
});

describe('pageMeta', () => {
  it('rounds pages up and never reports zero pages', () => {
    expect(pageMeta(1, 20, 41).totalPages).toBe(3);
    expect(pageMeta(1, 20, 0).totalPages).toBe(1);
  });
});
