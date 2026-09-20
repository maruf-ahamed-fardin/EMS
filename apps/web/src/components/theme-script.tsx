import { DEFAULT_THEME, DARK_QUERY, THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Sets the theme on `<html>` before the page paints, so there is no flash of the wrong one.
 *
 * This is a server component on purpose. React 19 warns when a client component renders a
 * `<script>` ("Scripts inside React components are never executed when rendering on the client"),
 * which is what next-themes did. Rendered here it is part of the server-sent HTML, runs once, and
 * is never re-rendered on the client.
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

  return <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />;
}
