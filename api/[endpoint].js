import mysql from 'mysql2/promise';

const ENDPOINTS = {
  users:          { key: 'sharedUsers',    type: 'array',  field: 'users' },
  'profile-pics': { key: 'profilePics',    type: 'object', field: 'profilePics' },
  profiles:       { key: 'sharedProfiles', type: 'object', field: 'profiles' },
};

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
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint } = req.query;
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
