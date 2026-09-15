/** Letters, digits, ".", "_" and "-", up to 64 characters, and not just dots */
export const USERNAME_PATTERN = /^(?!\.+$)[\p{L}\p{N}._-]{1,64}$/u;

// First path segments the frontend uses for its own pages and files, so no member can have them
const RESERVED = new Set([
  '_next', 'admin', 'api', 'assets', 'favicon.ico', 'health', 'login', 'logout', 'manifest.json', 'me',
  'public', 'reset-password', 'robots.txt', 'search', 'set-password', 'settings', 'sitemap.xml', 'static',
]);

export const isReservedUsername = (username: string) => RESERVED.has(username.toLowerCase());
