/** "Tanvir Hasan" → "TH", "Rahim" → "RA". Plain function: usable from server and client components. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]?.[0], parts.at(-1)?.[0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join('').toUpperCase() || '?';
}
