/** Builds a Team Profile URL from the current query plus the changes, dropping the page unless asked. */
export function teamProfileHref(
  current: Record<string, string | undefined>,
  changes: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  // A new search or filter starts at page one
  if (!('page' in changes)) delete merged.page;
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/team-profile?${query}` : '/team-profile';
}
