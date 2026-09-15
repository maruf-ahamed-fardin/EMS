import 'server-only';
import mysql from 'mysql2/promise';

// Fields safe to expose publicly (no passwords, salaries, etc.)
const PUBLIC_USER_FIELDS = ['username', 'name', 'role', 'designation', 'employeeId'];

// ── In-memory cache (survives warm function invocations) ────────
// Short TTL ensures data stays fresh while avoiding DB hits on rapid page loads.
// Stores the in-flight promise so concurrent callers share a single query.
const CACHE_TTL = 30 * 1000; // 30 seconds
let cache = { promise: null, ts: 0 };

let pool = null;

function getPool() {
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
async function loadTeamData() {
  const [rows] = await getPool().execute(
    'SELECT k, v FROM kv_store WHERE k IN (?, ?, ?)',
    ['sharedUsers', 'profilePics', 'sharedProfiles']
  );

  const parsed = {};
  for (const row of rows) {
    try { parsed[row.k] = JSON.parse(row.v); }
    catch { parsed[row.k] = row.v; }
  }
  return parsed;
}

function getTeamData() {
  if (cache.promise && Date.now() - cache.ts < CACHE_TTL) return cache.promise;

  const promise = loadTeamData();
  cache = { promise, ts: Date.now() };
  // Don't keep a failed query around for the whole TTL
  promise.catch(() => {
    if (cache.promise === promise) cache = { promise: null, ts: 0 };
  });
  return promise;
}

/**
 * Looks up a team member by username, falling back to employee ID.
 * Returns null when nobody matches. `redirectTo` is set when the match
 * came from an employee ID, so callers can send visitors to the username URL.
 */
export async function findTeamMember(id) {
  const key = (id || '').toLowerCase();
  if (!key) return null;

  const data = await getTeamData();
  const allUsers = Array.isArray(data.sharedUsers) ? data.sharedUsers : [];

  let user = allUsers.find(u => u.username?.toLowerCase() === key);
  let redirectTo = null;
  if (!user) {
    user = allUsers.find(u => u.employeeId?.toLowerCase() === key);
    if (user) redirectTo = user.username;
  }
  if (!user) return null;

  const publicUser = {};
  for (const f of PUBLIC_USER_FIELDS) {
    if (user[f] !== undefined) publicUser[f] = user[f];
  }

  const pics = data.profilePics && typeof data.profilePics === 'object' ? data.profilePics : {};
  const profiles = data.sharedProfiles && typeof data.sharedProfiles === 'object' ? data.sharedProfiles : {};

  return {
    redirectTo,
    user: publicUser,
    profilePic: pics[user.username] || null,
    profileData: profiles[user.username] || null,
  };
}
