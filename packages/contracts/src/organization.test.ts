import { describe, expect, it } from 'vitest';
import { createDepartmentInput, createPositionInput, departmentListQuery, updateDepartmentInput, updatePositionInput } from './organization';

describe('department inputs', () => {
  it('normalizes the code and empty description', () => {
    expect(createDepartmentInput.parse({ name: ' Development ', code: 'dev', description: '  ' })).toEqual({
      name: 'Development',
      code: 'DEV',
      description: null,
    });
  });

  it('rejects codes that are not short identifiers', () => {
    for (const code of ['D', '1DEV', 'DEV-OPS', 'ABCDEFGHIJK']) {
      expect(createDepartmentInput.safeParse({ name: 'X', code }).success).toBe(false);
    }
  });

  it('allows clearing the head and rejects unknown fields on update', () => {
    expect(updateDepartmentInput.parse({ headEmployeeId: null })).toEqual({ headEmployeeId: null });
    expect(updateDepartmentInput.safeParse({ employees: [] }).success).toBe(false);
  });

  it('reads includeInactive from a query string', () => {
    expect(departmentListQuery.parse({ includeInactive: 'true' }).includeInactive).toBe(true);
    expect(departmentListQuery.parse({}).includeInactive).toBe(false);
  });
});

describe('position inputs', () => {
  it('requires a department choice, which may be none (shared position)', () => {
    expect(createPositionInput.safeParse({ title: 'Intern' }).success).toBe(false);
    expect(createPositionInput.parse({ title: ' Intern ', departmentId: null, level: '' })).toEqual({
      title: 'Intern',
      departmentId: null,
      level: null,
    });
  });

  it('accepts partial updates only', () => {
    expect(updatePositionInput.parse({ level: 'L3' })).toEqual({ level: 'L3' });
    expect(updatePositionInput.safeParse({ holders: 3 }).success).toBe(false);
  });
});
