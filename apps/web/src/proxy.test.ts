import { NextRequest } from 'next/server';
import { SESSION_COOKIE } from './lib/auth-paths';
import { proxy } from './proxy';

const run = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined));

describe('proxy', () => {
  it('sends a visitor without a session to login, remembering where they were going', () => {
    const response = run('/employees?page=2');
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/employees?page=2');
  });

  it('does not add ?next for the root path', () => {
    expect(run('/').headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets the login page through', () => {
    expect(run('/login').headers.get('location')).toBeNull();
  });

  it('lets a request with a session cookie through (the layout validates it)', () => {
    expect(run('/employees', `${SESSION_COOKIE}=anything`).headers.get('location')).toBeNull();
  });
});
