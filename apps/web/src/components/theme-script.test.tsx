import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/lib/theme';
import { ThemeScript } from './theme-script';

/**
 * The values in this script come from `lib/theme.ts` rather than the `'use client'` module next to
 * it: importing a constant from a client module into a server component yields a client reference,
 * not the value, and the script silently rendered `localStorage.getItem(undefined)`.
 */
describe('ThemeScript', () => {
  const html = renderToStaticMarkup(<ThemeScript nonce="test-nonce" />);

  it('renders the real storage key and default, never undefined', () => {
    expect(html).not.toContain('undefined');
    expect(html).toContain(`localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})`);
    expect(html).toContain(JSON.stringify(DEFAULT_THEME));
  });

  it('carries the CSP nonce, without which the script is blocked', () => {
    expect(html).toContain('nonce="test-nonce"');
  });

  it('applies a theme for every case the runtime can be in', () => {
    const run = (stored: string | null, prefersDark: boolean): string => {
      const classes: string[] = [];
      const element = {
        classList: {
          remove: (...names: string[]) => {
            for (const name of names) {
              const at = classes.indexOf(name);
              if (at !== -1) classes.splice(at, 1);
            }
          },
          add: (name: string) => classes.push(name),
        },
        style: { colorScheme: '' },
      };
      const source = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
      new Function(
        'localStorage',
        'window',
        'document',
        source,
      )(
        { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) },
        { matchMedia: () => ({ matches: prefersDark }) },
        { documentElement: element },
      );
      expect(element.style.colorScheme).toBe(classes[0]);
      return classes.join(' ');
    };

    expect(run(null, false)).toBe(DEFAULT_THEME); // never chosen
    expect(run(null, true)).toBe(DEFAULT_THEME); // never chosen, dark OS: the default still wins
    expect(run('dark', false)).toBe('dark');
    expect(run('light', true)).toBe('light');
    expect(run('system', true)).toBe('dark');
    expect(run('system', false)).toBe('light');
    expect(run('nonsense', false)).toBe(DEFAULT_THEME); // tampered storage
  });
});
