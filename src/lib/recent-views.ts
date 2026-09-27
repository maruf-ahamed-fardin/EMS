/**
 * LocalStorage utility to store and retrieve the 5 most recently viewed team members.
 */

const STORAGE_KEY = 'selorax_recent_views';
const MAX_RECENT = 5;

export function recordRecentView(username: string): void {
  if (typeof window === 'undefined' || !username) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((u) => typeof u === 'string' && u.toLowerCase() !== username.toLowerCase());
    const updated = [username, ...filtered].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore localStorage errors (e.g. quota, private browsing)
  }
}

export function getRecentViews(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
