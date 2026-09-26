import { describe, expect, it } from 'vitest';
import { tenure } from '@/lib/client/team-profile';

describe('tenure', () => {
  const today = new Date('2026-09-21T10:00:00Z');

  it('counts whole months only', () => {
    expect(tenure('2026-09-01', today)).toBe('New');
    expect(tenure('2026-08-22', today)).toBe('New'); // one day short of a month
    expect(tenure('2026-08-21', today)).toBe('1 mo');
    expect(tenure('2026-04-10', today)).toBe('5 mo');
  });

  it('switches to years, and drops a zero month', () => {
    expect(tenure('2025-09-21', today)).toBe('1 yr');
    expect(tenure('2024-05-02', today)).toBe('2 yr 4 mo');
  });

  it('never goes negative for a future start date', () => {
    expect(tenure('2026-10-01', today)).toBe('New');
  });
});
