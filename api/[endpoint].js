import mysql from 'mysql2/promise';

// Fields safe to expose publicly (no passwords, salaries, etc.)
const PUBLIC_USER_FIELDS = ['username', 'name', 'role', 'designation', 'employeeId'];

// ── In-memory cache (survives warm function invocations) ────────
// Short TTL ensures data stays fresh while avoiding DB hits on rapid page loads
const CACHE_TTL = 30 * 1000; // 30 seconds
let cache = { data: null, ts: 0 };

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
async function getTeamData() {
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  const db = getPool();
  const [rows] = await db.execute(
    'SELECT k, v FROM kv_store WHERE k IN (?, ?, ?)',
    ['sharedUsers', 'profilePics', 'sharedProfiles']
  );

  const parsed = {};
  for (const row of rows) {
    try { parsed[row.k] = JSON.parse(row.v); }
    catch { parsed[row.k] = row.v; }
  }

  cache = { data: parsed, ts: Date.now() };
  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint } = req.query;

    if (endpoint !== 'team-profile') {
      return res.status(404).json({ error: `Unknown endpoint: ${endpoint}` });
    }

    const id = (req.query.id || '').toLowerCase();
    if (!id) return res.status(400).json({ error: 'id parameter required' });

    // Single DB query (or memory cache hit) for all data
    const data = await getTeamData();
    const users = data.sharedUsers;
    const pics = data.profilePics;
    const profiles = data.sharedProfiles;

    const allUsers = Array.isArray(users) ? users : [];
    let user = allUsers.find(u => u.username?.toLowerCase() === id);
    let redirectTo = null;
    if (!user) {
      const byEmpId = allUsers.find(u => u.employeeId?.toLowerCase() === id);
      if (byEmpId) {
        user = byEmpId;
        redirectTo = byEmpId.username;
      }
    }

    if (!user) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(404).json({ found: false });
    }

    const publicUser = {};
    for (const f of PUBLIC_USER_FIELDS) {
      if (user[f] !== undefined) publicUser[f] = user[f];
    }

    const picsObj = pics && typeof pics === 'object' ? pics : {};
    const profilesObj = profiles && typeof profiles === 'object' ? profiles : {};

    // CDN: 30s cache, 60s stale-while-revalidate (keeps data fresh after updates)
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      found: true,
      redirectTo,
      user: publicUser,
      profilePic: picsObj[user.username] || null,
      profileData: profilesObj[user.username] || null,
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
