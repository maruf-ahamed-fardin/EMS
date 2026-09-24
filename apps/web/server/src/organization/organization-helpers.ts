const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids that can't be UUIDs are "not found" without a database round trip. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** "1 active employee", "22 active employees". */
export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
