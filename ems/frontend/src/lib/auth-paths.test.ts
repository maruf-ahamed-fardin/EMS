import { HOME_PATH, isPublicPath, safeNextPath } from './auth-paths';

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
