'use client';

import { DEFAULT_THEME, DARK_QUERY, THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Sets the theme on `<html>` before the page paints, so there is no flash of the wrong one.
 *
 * Only the server-rendered copy runs. When React creates the element in the browser instead of
 * hydrating it (the root `<head>` is client-rendered after an error or a root remount), a script
 * would never execute and React 19 warns "Encountered a script tag while rendering React
 * component". On the client it is therefore a `text/plain` data block, which React leaves alone;
 * the `type` mismatch against the server HTML is covered by `suppressHydrationWarning`.
 *
 * `nonce` is the per-request CSP nonce from `proxy.ts`; without it the script is blocked.
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const fallback = JSON.stringify(DEFAULT_THEME);
  const query = JSON.stringify(DARK_QUERY);

  // Kept in step with applyTheme() in lib/theme.ts. Failures are swallowed: a blocked localStorage
  // must not stop the page rendering, it just means the default theme is used.
  const script =
    `(function(){try{` +
    `var t=localStorage.getItem(${key});` +
    `if(t!=="light"&&t!=="dark"&&t!=="system")t=${fallback};` +
    `var r=t==="system"?(window.matchMedia(${query}).matches?"dark":"light"):t;` +
    `var e=document.documentElement;` +
    `e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r;` +
    `}catch(_){}})();`;

  return (
    <script
      type={typeof window === 'undefined' ? undefined : 'text/plain'}
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
