import 'server-only';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

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

// ── Built-in fallback demo data (used when database is unreachable or unset) ──
const FALLBACK_TEAM_DATA: TeamData = {
  sharedUsers: [
    {
      username: 'ashekrabbani',
      name: 'Ashek Rabbani',
      role: 'Software Engineer',
      designation: 'Lead Full Stack Engineer',
      employeeId: 'SX-001',
      department: 'Engineering',
      skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'GraphQL'],
      timezone: 'Asia/Dhaka',
      status: { available: true, text: 'Available' },
      verified: true,
      calendlyUrl: 'https://cal.com/ashekrabbani',
    },
    {
      username: 'fardin',
      name: 'Maruf Ahamed Fardin',
      role: 'Frontend Engineer',
      designation: 'UI/UX & Frontend Specialist',
      employeeId: 'SX-002',
      department: 'Design',
      skills: ['UI/UX Design', 'Figma', 'Next.js', 'Tailwind CSS', 'Framer Motion', 'Design Systems'],
      timezone: 'Asia/Dhaka',
      status: { available: true, text: 'In Flow' },
      verified: true,
      calendlyUrl: 'https://cal.com/fardin',
    },
    {
      username: 'selorax-admin',
      name: 'SeloraX Operations',
      role: 'Admin',
      designation: 'Global Operations Desk',
      employeeId: 'SX-000',
      department: 'Operations',
      skills: ['DevOps', 'Infrastructure', 'Security', 'Incident Response', 'Cloud Systems'],
      timezone: 'Asia/Dhaka',
      status: { available: true, text: '24/7 Monitoring' },
      verified: true,
      calendlyUrl: 'https://cal.com/selorax',
    },
    {
      username: 'tanvir',
      name: 'Tanvir Hossain',
      role: 'Chief Executive Officer',
      designation: 'Founder & CEO',
      employeeId: 'SX-100',
      department: 'Executive',
      skills: ['Leadership', 'Product Strategy', 'Venture Capital', 'Architecture', 'Enterprise'],
      timezone: 'Asia/Dhaka',
      status: { available: true, text: 'Available for Meetings' },
      verified: true,
      calendlyUrl: 'https://cal.com/tanvir-selorax',
    },
  ],
  profilePics: {
    ashekrabbani: 'https://avatars.githubusercontent.com/u/101377810?v=4',
    fardin: 'https://avatars.githubusercontent.com/u/89617260?v=4',
    'selorax-admin': null,
    tanvir: null,
  },
  sharedProfiles: {
    ashekrabbani: {
      email: 'ashekrabbani@selorax.io',
      personalPhone: '+8801700000001',
      businessPhone: '+8801606606204',
      whatsapp: '+8801606606204',
      location: 'Dhaka, Bangladesh',
      calendlyUrl: 'https://cal.com/ashekrabbani',
      socials: {
        github: 'https://github.com/ashekrabbani',
        linkedin: 'https://linkedin.com/in/ashekrabbani',
        facebook: 'https://www.facebook.com/selorax.io/',
        portfolio: 'https://selorax.io',
      },
    },
    fardin: {
      email: 'fardin@selorax.io',
      personalPhone: '+8801700000002',
      businessPhone: '+8801606606204',
      whatsapp: '+8801606606204',
      location: 'Dhaka, Bangladesh',
      calendlyUrl: 'https://cal.com/fardin',
      socials: {
        github: 'https://github.com/maruf-ahamed-fardin',
        linkedin: 'https://linkedin.com/in/maruf-ahamed-fardin',
        facebook: 'https://www.facebook.com/selorax.io/',
        portfolio: 'https://selorax.io',
      },
    },
    'selorax-admin': {
      email: 'contact@selorax.io',
      businessPhone: '+8801606606204',
      whatsapp: '+8801606606204',
      location: 'Dhaka HQ, Bangladesh',
      calendlyUrl: 'https://cal.com/selorax',
      socials: {
        github: 'https://github.com/SeloraX-io',
        facebook: 'https://www.facebook.com/selorax.io/',
        portfolio: 'https://selorax.io',
      },
    },
    tanvir: {
      email: 'tanvir@selorax.io',
      businessPhone: '+8801606606204',
      whatsapp: '+8801606606204',
      location: 'Dhaka HQ, Bangladesh',
      calendlyUrl: 'https://cal.com/tanvir-selorax',
      socials: {
        linkedin: 'https://linkedin.com/company/selorax',
        github: 'https://github.com/SeloraX-io',
        facebook: 'https://www.facebook.com/selorax.io/',
        portfolio: 'https://selorax.io',
      },
    },
  },
};

// ── In-memory cache (survives warm function invocations) ────────
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
      ssl: process.env.MYSQL_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Single query for all 3 keys instead of 3 separate queries
async function loadTeamData(): Promise<TeamData> {
  if (!process.env.MYSQL_HOST) {
    return FALLBACK_TEAM_DATA;
  }

  try {
    const [rows] = await getPool().execute<KvRow[]>(
      'SELECT k, v FROM kv_store WHERE k IN (?, ?, ?)',
      ['sharedUsers', 'profilePics', 'sharedProfiles']
    );

    const parsed: Record<string, unknown> = {};
    for (const row of rows) {
      try { parsed[row.k] = JSON.parse(row.v); }
      catch { parsed[row.k] = row.v; }
    }

    if (!parsed.sharedUsers) {
      return FALLBACK_TEAM_DATA;
    }

    return parsed;
  } catch (error) {
    console.warn('[SeloraX Team] Database query failed or unavailable. Serving fallback team data.', error);
    return FALLBACK_TEAM_DATA;
  }
}

function getTeamData(): Promise<TeamData> {
  if (cache.promise && Date.now() - cache.ts < CACHE_TTL) return cache.promise;

  const promise = loadTeamData();
  cache = { promise, ts: Date.now() };
  promise.catch(() => {
    if (cache.promise === promise) cache = { promise: null, ts: 0 };
  });
  return promise;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const lower = (value: unknown) => String(value ?? '').toLowerCase();

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

/**
 * Looks up a team member by username, employee ID, or name (all case-insensitive).
 * Returns null when nobody matches.
 */
export async function findTeamMember(id: string): Promise<TeamMember | null> {
  let raw = id;
  try { raw = decodeURIComponent(id); } catch {}
  const key = raw.trim().toLowerCase();
  if (!key) return null;

  const data = await getTeamData();
  const allUsers = (Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[];

  // 1. Exact username match (case-insensitive)
  let user = allUsers.find(u => lower(u.username) === key);
  let redirectTo: string | null = null;

  // 2. Exact employee ID match (e.g. "sx-001")
  if (!user) {
    user = allUsers.find(u => lower(u.employeeId) === key);
    if (user) redirectTo = user.username ?? null;
  }

  // 3. Exact full name match (case-insensitive)
  if (!user) {
    user = allUsers.find(u => lower(u.name) === key);
    if (user) redirectTo = user.username ?? null;
  }

  // 4. Partial name match (e.g. "ashek", "rabbani", "maruf", "fardin")
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
  const profiles = asRecord(data.sharedProfiles);
  const userProfile = asRecord(profiles[username]) as ProfileData;

  // Defaults if missing
  if (!publicUser.department) publicUser.department = 'Engineering';
  if (!publicUser.timezone) publicUser.timezone = 'Asia/Dhaka';
  if (!publicUser.status) publicUser.status = { available: true, text: 'Available' };
  if (publicUser.verified === undefined) publicUser.verified = true;

  return {
    redirectTo,
    user: publicUser,
    profilePic: (asRecord(data.profilePics)[username] as string | undefined) || null,
    profileData: userProfile || null,
  };
}

/**
 * Returns a list of public team members for directory/demo display.
 */
export async function getFeaturedMembers(): Promise<PublicUser[]> {
  const data = await getTeamData();
  const allUsers = (Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[];

  return allUsers.map(user => {
    const pub: PublicUser = {};
    for (const f of PUBLIC_USER_FIELDS) {
      if (user[f] !== undefined) (pub as Record<string, unknown>)[f] = user[f];
    }
    return pub;
  });
}

/**
 * Returns all team members with summaries and profile pictures for real-time search.
 */
export async function getAllTeamMembers(): Promise<PublicMemberSummary[]> {
  const data = await getTeamData();
  const allUsers = (Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[];
  const pics = asRecord(data.profilePics);

  return allUsers.map(user => {
    const username = String(user.username || '');
    return {
      username,
      name: String(user.name || ''),
      role: user.role,
      designation: user.designation,
      employeeId: user.employeeId,
      department: (user.department as string) || 'Engineering',
      skills: (user.skills as string[]) || [],
      status: (user.status as UserStatus) || { available: true, text: 'Available' },
      verified: user.verified ?? true,
      profilePic: (pics[username] as string | undefined) || null,
    };
  });
}

export interface FullAdminMember {
  user: PublicUser;
  profilePic?: string | null;
  profileData?: ProfileData | null;
}

/**
 * Returns full member details including contact and picture for the Admin dashboard.
 */
export async function getFullAdminMembers(): Promise<FullAdminMember[]> {
  const data = await getTeamData();
  const allUsers = (Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[];
  const pics = asRecord(data.profilePics);
  const profiles = asRecord(data.sharedProfiles);

  return allUsers.map(user => {
    const username = String(user.username || '');
    return {
      user: {
        username,
        name: user.name,
        role: user.role,
        designation: user.designation,
        employeeId: user.employeeId,
        department: user.department,
        skills: user.skills || [],
        status: user.status || { available: true, text: 'Available' },
        timezone: user.timezone || 'Asia/Dhaka',
        verified: user.verified ?? true,
        calendlyUrl: user.calendlyUrl,
      },
      profilePic: (pics[username] as string | undefined) || null,
      profileData: (profiles[username] as ProfileData | undefined) || null,
    };
  });
}

/**
 * Saves team data to MySQL if configured, and keeps the in-memory cache updated.
 */
export async function saveTeamData(newData: TeamData): Promise<void> {
  cache = { promise: Promise.resolve(newData), ts: Date.now() };

  FALLBACK_TEAM_DATA.sharedUsers = newData.sharedUsers;
  FALLBACK_TEAM_DATA.profilePics = newData.profilePics;
  FALLBACK_TEAM_DATA.sharedProfiles = newData.sharedProfiles;

  if (!process.env.MYSQL_HOST) {
    return;
  }

  try {
    const p = getPool();
    await p.execute(
      `CREATE TABLE IF NOT EXISTS kv_store (
        k VARCHAR(64) PRIMARY KEY,
        v LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const keys: (keyof TeamData)[] = ['sharedUsers', 'profilePics', 'sharedProfiles'];
    for (const key of keys) {
      const val = JSON.stringify(newData[key] ?? (key === 'sharedUsers' ? [] : {}));
      await p.execute(
        'INSERT INTO kv_store (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
        [key, val]
      );
    }
  } catch (error) {
    console.error('[SeloraX Team] Failed to write to MySQL database:', error);
    throw new Error('Database write operation failed. Please verify MySQL configuration.');
  }
}

/**
 * Creates a new team member and saves it.
 */
export async function createTeamMember(member: {
  user: PublicUser;
  profilePic?: string | null;
  profileData?: ProfileData | null;
}): Promise<void> {
  const data = await getTeamData();
  const allUsers = [...((Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[])];
  const pics = { ...asRecord(data.profilePics) };
  const profiles = { ...asRecord(data.sharedProfiles) };

  const username = String(member.user.username || '').toLowerCase().trim();
  if (!username) throw new Error('Username is required');

  if (allUsers.some(u => String(u.username).toLowerCase() === username)) {
    throw new Error(`Username "${username}" already exists.`);
  }

  allUsers.push({
    ...member.user,
    username,
    department: member.user.department || 'Engineering',
    status: member.user.status || { available: true, text: 'Available' },
    verified: member.user.verified ?? true,
    timezone: member.user.timezone || 'Asia/Dhaka',
  });

  if (member.profilePic) {
    pics[username] = member.profilePic;
  }

  if (member.profileData) {
    profiles[username] = member.profileData;
  }

  await saveTeamData({
    sharedUsers: allUsers,
    profilePics: pics,
    sharedProfiles: profiles,
  });
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
  const allUsers = [...((Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[])];
  const pics = { ...asRecord(data.profilePics) };
  const profiles = { ...asRecord(data.sharedProfiles) };

  const key = username.toLowerCase().trim();
  const index = allUsers.findIndex(u => String(u.username).toLowerCase() === key);
  if (index === -1) throw new Error(`Member "${username}" not found.`);

  allUsers[index] = {
    ...allUsers[index],
    ...updated.user,
    username: allUsers[index].username,
  };

  if (updated.profilePic !== undefined) {
    if (updated.profilePic === null || updated.profilePic === '') {
      delete pics[key];
    } else {
      pics[key] = updated.profilePic;
    }
  }

  if (updated.profileData !== undefined) {
    profiles[key] = {
      ...asRecord(profiles[key]),
      ...updated.profileData,
    };
  }

  await saveTeamData({
    sharedUsers: allUsers,
    profilePics: pics,
    sharedProfiles: profiles,
  });
}

/**
 * Deletes a team member.
 */
export async function deleteTeamMember(username: string): Promise<void> {
  const data = await getTeamData();
  const allUsers = ((Array.isArray(data.sharedUsers) ? data.sharedUsers : []) as StoredUser[])
    .filter(u => String(u.username).toLowerCase() !== username.toLowerCase().trim());
  const pics = { ...asRecord(data.profilePics) };
  const profiles = { ...asRecord(data.sharedProfiles) };

  const key = username.toLowerCase().trim();
  delete pics[key];
  delete profiles[key];

  await saveTeamData({
    sharedUsers: allUsers,
    profilePics: pics,
    sharedProfiles: profiles,
  });
}
