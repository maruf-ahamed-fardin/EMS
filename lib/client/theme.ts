/**
 * Theme values shared by the client hook and the server-rendered inline script.
 *
 * Deliberately not a `'use client'` module: importing a value from one of those into a server
 * component gives a client reference rather than the value, which silently renders `undefined`
 * into the script.
 */

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];
/** What is actually painted: "system" has been resolved against the OS setting. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
/** What a visitor who has never chosen gets, and what the inline script falls back to. */
export const DEFAULT_THEME: Theme = 'light';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Applies the theme to `<html>`: the class Tailwind's `dark:` variants read, and `color-scheme`,
 * which is what makes form controls and scrollbars follow the theme.
 *
 * Kept in step with the inline script in `components/theme-script.tsx`, so the first paint and
 * every later change agree.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}
