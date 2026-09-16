import { describe, expect, it } from 'vitest';
import { isSafeLink, safeUrl } from '@/server/lib/links';

describe('safeUrl', () => {
  it('adds https to a bare domain, which is how HR stores social links', () => {
    expect(safeUrl('github.com/me')).toBe('https://github.com/me');
    expect(safeUrl('selorax.io')).toBe('https://selorax.io/');
  });

  it('keeps a URL that already has a scheme', () => {
    expect(safeUrl('https://selorax.io/team')).toBe('https://selorax.io/team');
    expect(safeUrl('http://internal.selorax.io')).toBe('http://internal.selorax.io/');
  });

  it('refuses a scheme that could run code or carry a payload', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'vbscript:msgbox']) {
      expect(safeUrl(bad)).toBeNull();
    }
  });

  it('refuses empty and blank values', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });

  it('allows a host with a port, which is not a scheme', () => {
    expect(safeUrl('internal.selorax.io:8080/team')).toBe('https://internal.selorax.io:8080/team');
  });

  it('trims surrounding space', () => {
    expect(safeUrl('  github.com/me  ')).toBe('https://github.com/me');
  });

  it('isSafeLink agrees with it', () => {
    expect(isSafeLink('github.com/me')).toBe(true);
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
  });
});
