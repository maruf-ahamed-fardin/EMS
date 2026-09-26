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

/**
 * How long someone has been here, from a `YYYY-MM-DD` joining date: `New`, `5 mo`, `2 yr`,
 * `2 yr 4 mo`. Whole months only, so a card never claims a month not yet completed.
 */
export function tenure(joiningDate: string, today: Date = new Date()): string {
  const [year, month, day] = joiningDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  let months = (today.getUTCFullYear() - year) * 12 + (today.getUTCMonth() + 1 - month);
  if (today.getUTCDate() < day) months -= 1;
  if (months < 1) return 'New';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}
