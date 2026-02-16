import mysql from 'mysql2/promise';

const ENDPOINTS = {
  users:          { key: 'sharedUsers',    type: 'array',  field: 'users' },
  'profile-pics': { key: 'profilePics',    type: 'object', field: 'profilePics' },
  profiles:       { key: 'sharedProfiles', type: 'object', field: 'profiles' },
};

// Fields safe to expose publicly (no passwords, salaries, etc.)
const PUBLIC_USER_FIELDS = ['username', 'name', 'role', 'designation', 'employeeId'];

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

async function getFromDb(key) {
  const db = getPool();
  const [rows] = await db.execute('SELECT v FROM kv_store WHERE k = ?', [key]);
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].v);
  } catch {
    return rows[0].v;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint } = req.query;

    // ── Single-call team profile endpoint ─────────────────────────
    // Returns one user's public data + profile pic + profile in 1 request
    // CDN cached for 60s so repeat visits are instant
    if (endpoint === 'team-profile') {
      const id = (req.query.id || '').toLowerCase();
      if (!id) return res.status(400).json({ error: 'id parameter required' });

      // Fetch all 3 data sources in parallel (server-side, single cold start)
      const [users, pics, profiles] = await Promise.all([
        getFromDb('sharedUsers'),
        getFromDb('profilePics'),
        getFromDb('sharedProfiles'),
      ]);

      const allUsers = Array.isArray(users) ? users : [];
      // Match by username first, then by employeeId
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
        res.setHeader('Cache-Control', 'public, s-maxage=30');
        return res.status(404).json({ found: false });
      }

      // Strip sensitive fields
      const publicUser = {};
      for (const f of PUBLIC_USER_FIELDS) {
        if (user[f] !== undefined) publicUser[f] = user[f];
      }

      const picsObj = pics && typeof pics === 'object' ? pics : {};
      const profilesObj = profiles && typeof profiles === 'object' ? profiles : {};

      // Cache for 60s at CDN edge, revalidate in background
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({
        found: true,
        redirectTo,
        user: publicUser,
        profilePic: picsObj[user.username] || null,
        profileData: profilesObj[user.username] || null,
      });
    }

    // ── Generic KV endpoints (legacy) ─────────────────────────────
    res.setHeader('Cache-Control', 'no-store');
    const config = ENDPOINTS[endpoint];

    if (!config) {
      return res.status(404).json({ error: `Unknown endpoint: ${endpoint}` });
    }

    const data = await getFromDb(config.key);

    if (config.type === 'array') {
      return res.status(200).json({ [config.field]: Array.isArray(data) ? data : [] });
    } else {
      return res.status(200).json({ [config.field]: data && typeof data === 'object' ? data : {} });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
