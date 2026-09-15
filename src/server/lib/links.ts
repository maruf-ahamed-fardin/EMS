/**
 * Only http(s) links are allowed; bare domains like "github.com/me" count as https.
 * Same rule as safeUrl in the frontend's profile page.
 */
export function isSafeLink(value: string): boolean {
  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
