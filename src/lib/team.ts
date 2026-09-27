import 'server-only';
import { put, head, del } from '@vercel/blob';

export type Department = 'Engineering' | 'Operations' | 'Design' | 'Executive' | 'All';

export interface UserStatus {
  available: boolean;
  text: string;
}

export interface PublicUser {
  username?: string;
  name?: string;
  role?: string;
  designation?: string;
  employeeId?: string;
  department?: Department | string;
  skills?: string[];
  status?: UserStatus;
  timezone?: string;
  verified?: boolean;
  calendlyUrl?: string;
}

export interface Socials {
  facebook?: string;
  instagram?: string;
  github?: string;
  portfolio?: string;
  linkedin?: string;
  twitter?: string;
}

export interface ProfileData {
  email?: string;
  phone?: string;
  personalPhone?: string;
  businessPhone?: string;
  whatsapp?: string;
  location?: string;
  calendlyUrl?: string;
  socials?: Socials;
}

export interface TeamMember {
  redirectTo: string | null;
  user: PublicUser;
  profilePic: string | null;
  profileData: ProfileData | null;
}

type StoredUser = PublicUser & Record<string, unknown>;

interface TeamData {
  sharedUsers: StoredUser[];
  profilePics: Record<string, string | null>;
  sharedProfiles: Record<string, ProfileData>;
}

export interface PublicMemberSummary {
  username: string;
  name: string;
  role?: string;
  designation?: string;
  employeeId?: string;
  department?: string;
  skills?: string[];
  status?: UserStatus;
  profilePic?: string | null;
  verified?: boolean;
}

export interface FullAdminMember {
  user: PublicUser;
  profilePic?: string | null;
  profileData?: ProfileData | null;
}

// Fields safe to expose publicly (no passwords, salaries, etc.)
const PUBLIC_USER_FIELDS = [
  'username',
  'name',
  'role',
  'designation',
  'employeeId',
  'department',
  'skills',
  'status',
  'timezone',
  'verified',
  'calendlyUrl',
] as const;

const BLOB_PATHNAME = 'selorax-team-data.json';

// ── Empty initial state (no hardcoded members) ──
const EMPTY_TEAM_DATA: TeamData = {
  sharedUsers: [],
  profilePics: {},
  sharedProfiles: {},
};

// ── In-memory cache (survives warm function invocations) ──
const CACHE_TTL = 15 * 1000; // 15 seconds
let cache: { data: TeamData; ts: number } | null = null;

/**
 * Load team data from Vercel Blob (or MySQL fallback).
 * Falls back to empty data if neither is configured.
 */
async function loadTeamData(): Promise<TeamData> {
  // Try Vercel Blob first (preferred)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      // Try to get the blob by listing or fetching directly
      const blobUrl = process.env.TEAM_DATA_BLOB_URL;
      if (blobUrl) {
        const res = await fetch(blobUrl, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json() as TeamData;
          return {
            sharedUsers: Array.isArray(json.sharedUsers) ? json.sharedUsers : [],
            profilePics: (json.profilePics && typeof json.profilePics === 'object') ? json.profilePics as Record<string, string | null> : {},
            sharedProfiles: (json.sharedProfiles && typeof json.sharedProfiles === 'object') ? json.sharedProfiles as Record<string, ProfileData> : {},
          };
        }
      }
    } catch (err) {
      console.warn('[SeloraX Team] Blob read failed, using empty data:', err);
    }
    return { ...EMPTY_TEAM_DATA, sharedUsers: [], profilePics: {}, sharedProfiles: {} };
  }

  // MySQL fallback
  if (process.env.MYSQL_HOST) {
    try {
      const mysql = await import('mysql2/promise');
      interface KvRow { k: string; v: string; }
      const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'selorax',
        connectionLimit: 3,
        ssl: process.env.MYSQL_SSL === 'false' ? undefined : { rejectUnauthorized: false },
      });
      const [rows] = await pool.execute<(KvRow & import('mysql2').RowDataPacket)[]>(
        'SELECT k, v FROM kv_store WHERE k IN (?, ?, ?)',
        ['sharedUsers', 'profilePics', 'sharedProfiles']
      );
      await pool.end();
      const parsed: Record<string, unknown> = {};
      for (const row of rows) {
        try { parsed[row.k] = JSON.parse(row.v); } catch { parsed[row.k] = row.v; }
      }
      return {
        sharedUsers: Array.isArray(parsed.sharedUsers) ? parsed.sharedUsers as StoredUser[] : [],
        profilePics: (parsed.profilePics && typeof parsed.profilePics === 'object') ? parsed.profilePics as Record<string, string | null> : {},
        sharedProfiles: (parsed.sharedProfiles && typeof parsed.sharedProfiles === 'object') ? parsed.sharedProfiles as Record<string, ProfileData> : {},
      };
    } catch (err) {
      console.warn('[SeloraX Team] MySQL read failed:', err);
    }
  }

  return { ...EMPTY_TEAM_DATA };
}

function getCache(): TeamData | null {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  return null;
}

function setCache(data: TeamData) {
  cache = { data, ts: Date.now() };
}

async function getTeamData(): Promise<TeamData> {
  const cached = getCache();
  if (cached) return cached;
  const data = await loadTeamData();
  setCache(data);
  return data;
}

/**
 * Persist team data to Vercel Blob (or MySQL).
 * Also updates in-memory cache immediately.
 */
export async function saveTeamData(newData: TeamData): Promise<void> {
  setCache(newData);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const json = JSON.stringify(newData, null, 0);
      const blob = await put(BLOB_PATHNAME, json, {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
      });
      // Store the blob URL in environment for future reads
      // Since we can't set env vars at runtime, we store it and read from the known pathname
      console.log('[SeloraX Team] Data saved to Blob:', blob.url);
      // Update cache with the blob URL so same server instance can re-read
      (process.env as Record<string, string>).TEAM_DATA_BLOB_URL = blob.url;
    } catch (err) {
      console.error('[SeloraX Team] Blob write failed:', err);
      throw new Error('Failed to save team data. Check BLOB_READ_WRITE_TOKEN.');
    }
    return;
  }

  if (process.env.MYSQL_HOST) {
    try {
      const mysql = await import('mysql2/promise');
      const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'selorax',
        connectionLimit: 3,
        ssl: process.env.MYSQL_SSL === 'false' ? undefined : { rejectUnauthorized: false },
      });
      await pool.execute(`CREATE TABLE IF NOT EXISTS kv_store (k VARCHAR(64) PRIMARY KEY, v LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      const keys: (keyof TeamData)[] = ['sharedUsers', 'profilePics', 'sharedProfiles'];
      for (const key of keys) {
        await pool.execute(
          'INSERT INTO kv_store (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
          [key, JSON.stringify(newData[key] ?? (key === 'sharedUsers' ? [] : {}))]
        );
      }
      await pool.end();
    } catch (err) {
      console.error('[SeloraX Team] MySQL write failed:', err);
      throw new Error('Database write failed.');
    }
    return;
  }

  // No storage configured — data lives only in memory (lost on cold start)
  console.warn('[SeloraX Team] No persistent storage configured. Data will be lost on server restart. Set BLOB_READ_WRITE_TOKEN for persistence.');
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const lower = (value: unknown) => String(value ?? '').toLowerCase();

/**
 * Slugify a string into a valid lowercase username (no spaces, only a-z0-9 and hyphens).
 */
export function slugifyUsername(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9-]/g, '')      // only allow a-z, 0-9, hyphen
    .replace(/-{2,}/g, '-')           // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')          // trim leading/trailing hyphens
    .slice(0, 32);
}

/**
 * Looks up a team member by username, employee ID, or name (all case-insensitive).
 */
export async function findTeamMember(id: string): Promise<TeamMember | null> {
  let raw = id;
  try { raw = decodeURIComponent(id); } catch {}
  const key = raw.trim().toLowerCase();
  if (!key) return null;

  const data = await getTeamData();
  const allUsers = data.sharedUsers;

  let user = allUsers.find(u => lower(u.username) === key);
  let redirectTo: string | null = null;

  if (!user) {
    user = allUsers.find(u => lower(u.employeeId) === key);
    if (user) redirectTo = user.username ?? null;
  }

  if (!user) {
    user = allUsers.find(u => lower(u.name) === key);
    if (user) redirectTo = user.username ?? null;
  }

  if (!user) {
    user = allUsers.find(u => {
      const name = lower(u.name);
      return name.includes(key) || key.includes(name);
    });
    if (user) redirectTo = user.username ?? null;
  }

  if (!user) return null;

  const publicUser: PublicUser = {};
  for (const f of PUBLIC_USER_FIELDS) {
    if (user[f] !== undefined) (publicUser as Record<string, unknown>)[f] = user[f];
  }

  const username = String(user.username);
  const userProfile = (data.sharedProfiles[username] || null) as ProfileData | null;

  if (!publicUser.department) publicUser.department = 'Engineering';
  if (!publicUser.timezone) publicUser.timezone = 'Asia/Dhaka';
  if (!publicUser.status) publicUser.status = { available: true, text: 'Available' };
  if (publicUser.verified === undefined) publicUser.verified = true;

  return {
    redirectTo,
    user: publicUser,
    profilePic: data.profilePics[username] ?? null,
    profileData: userProfile,
  };
}

/**
 * Returns all team members with summaries for the public directory.
 */
export async function getAllTeamMembers(): Promise<PublicMemberSummary[]> {
  const data = await getTeamData();
  return data.sharedUsers.map(user => {
    const username = String(user.username || '');
    return {
      username,
      name: String(user.name || ''),
      role: user.role as string | undefined,
      designation: user.designation as string | undefined,
      employeeId: user.employeeId as string | undefined,
      department: (user.department as string) || 'Engineering',
      skills: (user.skills as string[]) || [],
      status: (user.status as UserStatus) || { available: true, text: 'Available' },
      verified: (user.verified as boolean) ?? true,
      profilePic: data.profilePics[username] ?? null,
    };
  });
}

/**
 * Returns full member details for the Admin dashboard.
 */
export async function getFullAdminMembers(): Promise<FullAdminMember[]> {
  const data = await getTeamData();
  return data.sharedUsers.map(user => {
    const username = String(user.username || '');
    return {
      user: {
        username,
        name: user.name as string | undefined,
        role: user.role as string | undefined,
        designation: user.designation as string | undefined,
        employeeId: user.employeeId as string | undefined,
        department: user.department as string | undefined,
        skills: (user.skills as string[]) || [],
        status: (user.status as UserStatus) || { available: true, text: 'Available' },
        timezone: (user.timezone as string) || 'Asia/Dhaka',
        verified: (user.verified as boolean) ?? true,
        calendlyUrl: user.calendlyUrl as string | undefined,
      },
      profilePic: data.profilePics[username] ?? null,
      profileData: data.sharedProfiles[username] ?? null,
    };
  });
}

/**
 * Creates a new team member.
 */
export async function createTeamMember(member: {
  user: PublicUser;
  profilePic?: string | null;
  profileData?: ProfileData | null;
}): Promise<void> {
  const data = await getTeamData();
  const allUsers = [...data.sharedUsers];
  const pics = { ...data.profilePics };
  const profiles = { ...data.sharedProfiles };

  const username = slugifyUsername(String(member.user.username || ''));
  if (!username) throw new Error('Username is required');

  if (allUsers.some(u => String(u.username).toLowerCase() === username)) {
    throw new Error(`Username "${username}" is already taken.`);
  }

  allUsers.push({
    ...member.user,
    username,
    department: member.user.department || 'Engineering',
    status: member.user.status || { available: true, text: 'Available' },
    verified: member.user.verified ?? true,
    timezone: member.user.timezone || 'Asia/Dhaka',
  } as StoredUser);

  if (member.profilePic) pics[username] = member.profilePic;
  if (member.profileData) profiles[username] = member.profileData;

  await saveTeamData({ sharedUsers: allUsers, profilePics: pics, sharedProfiles: profiles });
}

/**
 * Updates an existing team member.
 */
export async function updateTeamMember(
  username: string,
  updated: {
    user: Partial<PublicUser>;
    profilePic?: string | null;
    profileData?: Partial<ProfileData> | null;
  }
): Promise<void> {
  const data = await getTeamData();
  const allUsers = [...data.sharedUsers];
  const pics = { ...data.profilePics };
  const profiles = { ...data.sharedProfiles };

  const key = username.toLowerCase().trim();
  const index = allUsers.findIndex(u => String(u.username).toLowerCase() === key);
  if (index === -1) throw new Error(`Member "${username}" not found.`);

  allUsers[index] = {
    ...allUsers[index],
    ...updated.user,
    username: allUsers[index].username, // never change username
  };

  if (updated.profilePic !== undefined) {
    if (!updated.profilePic) {
      delete pics[key];
    } else {
      pics[key] = updated.profilePic;
    }
  }

  if (updated.profileData !== undefined && updated.profileData !== null) {
    profiles[key] = {
      ...asRecord(profiles[key]) as ProfileData,
      ...updated.profileData,
    };
  }

  await saveTeamData({ sharedUsers: allUsers, profilePics: pics, sharedProfiles: profiles });
}

/**
 * Deletes a team member permanently.
 */
export async function deleteTeamMember(username: string): Promise<void> {
  const data = await getTeamData();
  const key = username.toLowerCase().trim();
  const allUsers = data.sharedUsers.filter(u => String(u.username).toLowerCase() !== key);
  const pics = { ...data.profilePics };
  const profiles = { ...data.sharedProfiles };
  delete pics[key];
  delete profiles[key];
  await saveTeamData({ sharedUsers: allUsers, profilePics: pics, sharedProfiles: profiles });
}
