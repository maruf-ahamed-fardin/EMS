import { employeeListQuery } from '@/lib/validations';
import { describe, expect, it } from 'vitest';
import { parseSearchParams } from './search-params';

describe('parseSearchParams', () => {
  it('keeps valid parameters', () => {
    expect(parseSearchParams(employeeListQuery, { page: '2', q: 'rahim' })).toMatchObject({ page: 2, q: 'rahim' });
  });

  it('drops parameters that do not fit instead of failing the page', () => {
    const query = parseSearchParams(employeeListQuery, { page: '0', departmentId: 'junk', q: 'x'.repeat(101), status: 'ACTIVE' });
    expect(query).toMatchObject({ page: 1, status: 'ACTIVE' });
    expect(query).not.toHaveProperty('departmentId');
    expect(query).not.toHaveProperty('q');
  });
});
