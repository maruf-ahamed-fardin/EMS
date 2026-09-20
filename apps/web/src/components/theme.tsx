'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  applyTheme,
  DARK_QUERY,
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme';

export { isTheme, THEMES, type Theme } from '@/lib/theme';

/**
 * Suppresses transitions for one frame while the theme swaps, so colours cut over instead of every
 * element animating at once.
 */
function paint(resolved: ResolvedTheme): void {
  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode('*,*::before,*::after{transition:none!important;animation:none!important}'),
  );
  document.head.appendChild(style);
  applyTheme(resolved);
  // Reading a computed style forces a reflow, so the new colours are committed before transitions
  // come back; the value itself is not used.
  void window.getComputedStyle(document.body).opacity;
  setTimeout(() => style.remove(), 1);
}

/*
 * The chosen theme lives in localStorage and the OS preference in a media query: both are external
 * stores, so they are read through useSyncExternalStore rather than mirrored into state with
 * effects. Snapshots are primitives, which keeps them referentially stable between renders.
 */

const listeners = new Set<() => void>();

/** Tells this tab's subscribers that the choice changed; other tabs get the storage event. */
function emit(): void {
  for (const listener of listeners) listener();
}

function subscribeChoice(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function choiceSnapshot(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // private mode, or storage blocked
  }
}

function subscribeSystem(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function systemSnapshot(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** The server cannot know either value; the inline script fixes the page up before it paints. */
const serverChoice = (): Theme => DEFAULT_THEME;
const serverSystem = (): ResolvedTheme => 'light';

export interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

/**
 * Theme state for the app. The first paint is handled by the inline script in the document head,
 * not here, so there is no flash of the wrong theme and nothing renders a `<script>` on the client.
 *
 * There is no context: both sources are module-level external stores, so any client component can
 * read them without a provider.
 */
export function useTheme(): ThemeState {
  const theme = useSyncExternalStore(subscribeChoice, choiceSnapshot, serverChoice);
  const system = useSyncExternalStore(subscribeSystem, systemSnapshot, serverSystem);
  const resolvedTheme: ResolvedTheme = theme === 'system' ? system : theme;

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice still applies to this page, it just is not remembered
    }
    paint(next === 'system' ? systemSnapshot() : next);
    emit();
  }, []);

  return useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
}

/**
 * Keeps `<html>` in step with the resolved theme. Needed for the one case the inline script and
 * `setTheme` do not cover: the OS flipping while the choice is "system".
 *
 * Mounted once, near the root. It holds no state — the stores above are the source of truth — so
 * it renders its children unchanged.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  return children;
}
