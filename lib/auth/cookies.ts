import { CSRF_COOKIE, SESSION_COOKIE } from '@/lib/validations';
import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '@/config/env';
import { generateToken } from '@/lib/http/security/tokens';
import { SESSION_ABSOLUTE_MS } from './session-policy';

function baseOptions(config: AppConfig): CookieOptions {
  return { secure: config.APP_URL.startsWith('https://'), sameSite: 'lax', path: '/' };
}

export function setSessionCookie(res: Response, config: AppConfig, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(config), httpOnly: true, maxAge: SESSION_ABSOLUTE_MS });
}

/** A fresh CSRF token, readable by the page so it can echo it in the header. Returns the token. */
export function setCsrfCookie(res: Response, config: AppConfig): string {
  const token = generateToken();
  res.cookie(CSRF_COOKIE, token, { ...baseOptions(config), httpOnly: false, maxAge: SESSION_ABSOLUTE_MS });
  return token;
}

export function clearAuthCookies(res: Response, config: AppConfig): void {
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(config), httpOnly: true });
  res.clearCookie(CSRF_COOKIE, baseOptions(config));
}
