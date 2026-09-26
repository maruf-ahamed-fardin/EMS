import { HOME_PATH, isPublicPath, safeNextPath } from '@/lib/auth/constants';

describe('safeNextPath', () => {
  it('keeps same-site paths with their query', () => {
    expect(safeNextPath('/employees?department=dev&page=2')).toBe('/employees?department=dev&page=2');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['absolute URL', 'https://evil.example/phish'],
    ['protocol-relative', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['dot segment before //', '/.//evil.example'],
    ['dot-dot segment before //', '/..//evil.example'],
    ['encoded dot before //', '/%2e//evil.example'],
    ['dot segment before a backslash', '/./\\evil.example'],
    ['javascript URL', 'javascript:alert(1)'],
    ['relative path', 'employees'],
    ['back to login', '/login?next=/dashboard'],
  ])('falls back to home for %s', (_case, value) => {
    expect(safeNextPath(value)).toBe(HOME_PATH);
  });
});

describe('isPublicPath', () => {
  it('matches the auth pages and their subpaths only', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/reset-password/abc')).toBe(true);
    expect(isPublicPath('/loginx')).toBe(false);
    expect(isPublicPath('/dashboard')).toBe(false);
  });
});
