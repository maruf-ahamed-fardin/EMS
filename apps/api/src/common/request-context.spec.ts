import { resolveRequestId } from './request-context';

describe('resolveRequestId', () => {
  it('reuses a well-formed incoming id', () => {
    expect(resolveRequestId('01J9ZK3Q-proxy-trace')).toBe('01J9ZK3Q-proxy-trace');
  });

  it('replaces missing, short or unsafe ids with a UUIDv7', () => {
    for (const header of [undefined, 'short', 'has spaces in it', 'x'.repeat(129), 'inject\nline']) {
      expect(resolveRequestId(header)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    }
  });
});
