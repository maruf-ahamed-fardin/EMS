import { createHash } from 'node:crypto';

export const KV_KEYS = ['sharedUsers', 'profilePics', 'sharedProfiles'] as const;
export type KvKey = (typeof KV_KEYS)[number];
/** Raw kv_store values (JSON text) by key */
export type KvValues = Partial<Record<KvKey, string>>;

// The only fields ever read from HR records. The rest (passwords, salaries, ...) is dropped on parse.
const USER_FIELDS = ['username', 'name', 'role', 'designation', 'employeeId'] as const;
const CONTACT_FIELDS = ['email', 'phone', 'personalPhone', 'businessPhone', 'whatsapp'] as const;
const SOCIAL_FIELDS = ['facebook', 'instagram', 'github', 'portfolio'] as const;
const KNOWN_CONTACT_FIELDS = new Set<string>([...CONTACT_FIELDS, 'socials']);
const KNOWN_SOCIAL_FIELDS = new Set<string>(SOCIAL_FIELDS);

export type HrUser = Partial<Record<(typeof USER_FIELDS)[number], string>>;
export type HrProfile = Partial<Record<(typeof CONTACT_FIELDS)[number], string>> & {
  socials: Partial<Record<(typeof SOCIAL_FIELDS)[number], string>>;
};

export interface HrSnapshot {
  users: HrUser[];
  /** Keyed by username exactly as the HR app writes it */
  profiles: Map<string, HrProfile>;
  pictures: Map<string, string>;
  sourceHashes: Record<KvKey, string | null>;
  /** Names (never values) of profile fields that aren't imported, for the report */
  unknownProfileFields: string[];
}

/** The HR data looks broken; the sync must stop rather than act on it. */
export class SnapshotError extends Error {}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Trimmed strings; numbers (e.g. numeric employee IDs) become strings; anything else is ignored. */
function text(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return undefined;
  return value.trim() || undefined;
}

function pick<K extends string>(source: Record<string, unknown>, fields: readonly K[]): Partial<Record<K, string>> {
  const picked: Partial<Record<K, string>> = {};
  for (const field of fields) {
    const value = text(source[field]);
    if (value !== undefined) picked[field] = value;
  }
  return picked;
}

function parseJson(key: KvKey, value: string | undefined, fallback: unknown): unknown {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new SnapshotError(`${key} is not valid JSON`);
  }
}

function parseObject(key: KvKey, value: string | undefined): Record<string, unknown> {
  const parsed = parseJson(key, value, {});
  if (!isRecord(parsed)) throw new SnapshotError(`${key} is not an object`);
  return parsed;
}

export function parseSnapshot(values: KvValues): HrSnapshot {
  const rawUsers = parseJson('sharedUsers', values.sharedUsers, undefined);
  if (rawUsers === undefined) throw new SnapshotError('sharedUsers is missing from kv_store');
  if (!Array.isArray(rawUsers)) throw new SnapshotError('sharedUsers is not a list');
  const users = rawUsers.filter(isRecord).map(record => pick(record, USER_FIELDS));
  if (users.length === 0) throw new SnapshotError('sharedUsers is empty');

  const pictures = new Map<string, string>();
  for (const [username, value] of Object.entries(parseObject('profilePics', values.profilePics))) {
    const picture = text(value);
    if (picture) pictures.set(username, picture);
  }

  const profiles = new Map<string, HrProfile>();
  const unknownFields = new Set<string>();
  for (const [username, value] of Object.entries(parseObject('sharedProfiles', values.sharedProfiles))) {
    if (!isRecord(value)) continue;
    const socials = isRecord(value.socials) ? value.socials : {};
    for (const field of Object.keys(value)) if (!KNOWN_CONTACT_FIELDS.has(field)) unknownFields.add(field);
    for (const field of Object.keys(socials)) if (!KNOWN_SOCIAL_FIELDS.has(field)) unknownFields.add(`socials.${field}`);
    profiles.set(username, { ...pick(value, CONTACT_FIELDS), socials: pick(socials, SOCIAL_FIELDS) });
  }

  const hash = (key: KvKey) => (values[key] === undefined ? null : sha256(values[key]));
  return {
    users,
    profiles,
    pictures,
    sourceHashes: { sharedUsers: hash('sharedUsers'), profilePics: hash('profilePics'), sharedProfiles: hash('sharedProfiles') },
    unknownProfileFields: [...unknownFields].sort(),
  };
}
