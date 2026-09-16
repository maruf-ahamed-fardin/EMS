import 'server-only';
import { readFile } from 'node:fs/promises';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { sslOptions } from '@/server/db/connection';
import { getEnv, type Env } from '@/server/env';

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

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Whether to verify the HR server's certificate when MYSQL_TLS says nothing.
 *
 * Production always verifies, and the env schema refuses an explicit `off` there. Elsewhere a
 * connection to this machine skips TLS, because a local MySQL serves a self-signed certificate
 * that can never verify and nothing crosses a network. A development server pointed at a remote
 * host still verifies: that is the case where credentials would travel in the clear.
 */
function hrTlsMode(env: Env, host: string): 'verify' | 'off' {
  if (env.MYSQL_TLS) return env.MYSQL_TLS;
  if (env.NODE_ENV === 'production') return 'verify';
  return LOOPBACK.has(host) ? 'off' : 'verify';
}

function getPool(): Pool {
  if (!pool) {
    const env = getEnv();
    // Production requires these, enforced in env.ts when the server starts, so a half-configured
    // deploy never quietly reads someone else's database. Outside production the old defaults
    // stand: the worst a wrong guess reaches is a MySQL on this machine.
    const local = env.NODE_ENV !== 'production';
    const host = env.MYSQL_HOST ?? (local ? '127.0.0.1' : undefined);
    const user = env.MYSQL_USER ?? (local ? 'root' : undefined);
    const database = env.MYSQL_DATABASE ?? (local ? 'selorax' : undefined);
    if (!host || !user || !database) {
      throw new Error('HR database is not configured: set MYSQL_HOST, MYSQL_USER and MYSQL_DATABASE');
    }

    pool = mysql.createPool({
      host,
      port: env.MYSQL_PORT,
      user,
      password: env.MYSQL_PASSWORD ?? '',
      database,
      waitForConnections: true,
      connectionLimit: 5,
      ssl: sslOptions({ tls: hrTlsMode(env, host), caFile: env.MYSQL_CA_FILE }),
      timezone: 'Z',
    });
  }
  return pool;
}

/**
 * Development stand-in for kv_store: the same three keys as a JSON file, so the site runs with no
 * database and no real credentials. Read fresh on every cache miss, so editing the file shows up.
 */
async function loadTeamDataFromFile(path: string): Promise<TeamData> {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch {
    throw new Error(`HR_DATA_FILE is set to "${path}", which cannot be read`);
  }
  try {
    return JSON.parse(contents) as TeamData;
  } catch {
    throw new Error(`HR_DATA_FILE "${path}" is not valid JSON`);
  }
}

// Single query for all 3 keys instead of 3 separate queries
async function loadTeamData(): Promise<TeamData> {
  const env = getEnv();
  // The env schema refuses HR_DATA_FILE in production, so this can never serve real visitors
  if (env.HR_DATA_FILE) return loadTeamDataFromFile(env.HR_DATA_FILE);

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
