import 'server-only';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

export interface PublicUser {
  username?: string;
  name?: string;
  role?: string;
  designation?: string;
  employeeId?: string;
}

export interface Socials {
  facebook?: string;
  instagram?: string;
  github?: string;
  portfolio?: string;
}

export interface ProfileData {
  email?: string;
  phone?: string;
  personalPhone?: string;
  businessPhone?: string;
  whatsapp?: string;
  socials?: Socials;
}

export interface TeamMember {
  /** Set when matched by employee ID, so callers can send visitors to the username URL */
  redirectTo: string | null;
  user: PublicUser;
  profilePic: string | null;
  profileData: ProfileData | null;
}

// Raw user records also hold private fields (passwords, salaries, etc.)
type StoredUser = PublicUser & Record<string, unknown>;

interface TeamData {
  sharedUsers?: unknown;
  profilePics?: unknown;
  sharedProfiles?: unknown;
}

interface KvRow extends RowDataPacket {
  k: string;
  v: string;
}

// Fields safe to expose publicly (no passwords, salaries, etc.)
const PUBLIC_USER_FIELDS = ['username', 'name', 'role', 'designation', 'employeeId'] as const;

// ── In-memory cache (survives warm function invocations) ────────
// Short TTL ensures data stays fresh while avoiding DB hits on rapid page loads.
// Stores the in-flight promise so concurrent callers share a single query.
const CACHE_TTL = 30 * 1000; // 30 seconds
let cache: { promise: Promise<TeamData> | null; ts: number } = { promise: null, ts: 0 };

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'selorax',
      waitForConnections: true,
      connectionLimit: 5,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Single query for all 3 keys instead of 3 separate queries
async function loadTeamData(): Promise<TeamData> {
  const [rows] = await getPool().execute<KvRow[]>(
    'SELECT k, v FROM kv_store WHERE k IN (?, ?, ?)',
    ['sharedUsers', 'profilePics', 'sharedProfiles']
  );

  const parsed: Record<string, unknown> = {};
  for (const row of rows) {
    try { parsed[row.k] = JSON.parse(row.v); }
    catch { parsed[row.k] = row.v; }
  }
  return parsed;
}

function getTeamData(): Promise<TeamData> {
  if (cache.promise && Date.now() - cache.ts < CACHE_TTL) return cache.promise;

  const promise = loadTeamData();
  cache = { promise, ts: Date.now() };
  // Don't keep a failed query around for the whole TTL
  promise.catch(() => {
    if (cache.promise === promise) cache = { promise: null, ts: 0 };
  });
  return promise;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const lower = (value: unknown) => String(value ?? '').toLowerCase();

/**
 * Looks up a team member by username (case-insensitive), falling back to employee ID.
 * Returns null when nobody matches.
 */
export async function findTeamMember(id: string): Promise<TeamMember | null> {
  const key = id.toLowerCase();
  if (!key) return null;

  const data = await getTeamData();
  const allUsers = (Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[];

  let user = allUsers.find(u => lower(u.username) === key);
  let redirectTo: string | null = null;
  if (!user) {
    user = allUsers.find(u => lower(u.employeeId) === key);
    if (user) redirectTo = user.username ?? null;
  }
  if (!user) return null;

  const publicUser: PublicUser = {};
  for (const f of PUBLIC_USER_FIELDS) {
    if (user[f] !== undefined) publicUser[f] = user[f];
  }

  const username = String(user.username);
  return {
    redirectTo,
    user: publicUser,
    profilePic: (asRecord(data.profilePics)[username] as string | undefined) || null,
    profileData: (asRecord(data.sharedProfiles)[username] as ProfileData | undefined) || null,
  };
}
