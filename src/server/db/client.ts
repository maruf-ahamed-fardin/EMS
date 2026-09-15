import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { getEnv } from '../env';
import { poolOptions } from './connection';
import * as schema from './schema';

export type Db = MySql2Database<typeof schema>;

// Kept on globalThis so hot reloads in development reuse the pool instead of opening another
const globalForDb = globalThis as unknown as { teamDb?: Db };

export function getDb(): Db {
  if (!globalForDb.teamDb) {
    const env = getEnv();
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    const pool = mysql.createPool(poolOptions({ url: env.DATABASE_URL, tls: env.DATABASE_TLS, caFile: env.DATABASE_CA_FILE }));
    globalForDb.teamDb = drizzle({ client: pool, schema, mode: 'default' });
  }
  return globalForDb.teamDb;
}
