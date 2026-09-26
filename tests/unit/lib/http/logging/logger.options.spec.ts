import { safeUrl } from '@/lib/http/logging/logger.options';

describe('safeUrl', () => {
  it('keeps download tokens and token parameters out of the logs', () => {
    expect(safeUrl('/api/v1/files/q0Zk9x-abc_DEF')).toBe('/api/v1/files/[redacted]');
    expect(safeUrl('/api/v1/files/q0Zk9x?x=1')).toBe('/api/v1/files/[redacted]?x=1');
    expect(safeUrl('/reset-password?token=abc123&next=/x')).toBe('/reset-password?token=[redacted]&next=/x');
    expect(safeUrl('/api/v1/employees?page=2')).toBe('/api/v1/employees?page=2');
    expect(safeUrl(undefined)).toBeUndefined();
  });
});
