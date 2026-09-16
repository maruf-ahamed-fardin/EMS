/**
 * Only http(s) links are allowed; bare domains like "github.com/me" count as https.
 * Shared by the profile page, the vCard and the sync, so all three agree on what a link is.
 */

/**
 * A scheme, but not a port: "javascript:" and "file:" match, "example.com:8080" does not, because
 * what follows the colon there is a number. Anything with a scheme we do not allow is refused
 * outright rather than left to be prefixed into something like https://file///etc/passwd.
 */
const FOREIGN_SCHEME = /^[a-z][a-z0-9+.-]*:(?![0-9])/i;
const HTTP_SCHEME = /^https?:\/\//i;

export function safeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!HTTP_SCHEME.test(text) && FOREIGN_SCHEME.test(text)) return null;

  try {
    const url = new URL(HTTP_SCHEME.test(text) ? text : `https://${text}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export const isSafeLink = (value: string): boolean => safeUrl(value) !== null;
