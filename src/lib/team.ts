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
