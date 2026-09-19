/**
 * The Content-Security-Policy for pages (plan §12). Scripts run only with this request's nonce (Next
 * adds it to its own scripts; `strict-dynamic` lets them load the rest), so an injected <script> or
 * inline handler never runs. Styles allow inline because Radix, Recharts and the meters set `style`
 * attributes, which nonces can't cover; injected CSS can't run code.
 */
export function contentSecurityPolicy(nonce: string, options: { dev: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Development only: the hot-reload socket
    `connect-src 'self'${options.dev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/** A fresh, unguessable nonce for one response. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
