import mysql, { type RowDataPacket } from 'mysql2/promise';
import { connectionOptions } from '@/server/db/connection';
import type { Env } from '@/server/env';
import { KV_KEYS, type KvValues } from './snapshot';

interface KvRow extends RowDataPacket {
  k: string;
  v: unknown;
}

// The column may be TEXT, BLOB or JSON, which mysql2 returns as a string, a Buffer or a parsed value
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return JSON.stringify(value);
}

/**
 * Reads the HR app's three keys from kv_store. This must never write there: connect with a
 * read-only DB user, and the read runs in a READ ONLY transaction as a second guard.
 */
export async function readKvStore(env: Env): Promise<KvValues> {
  if (!env.KV_DATABASE_URL) throw new Error('KV_DATABASE_URL is not set');
  const connection = await mysql.createConnection(
    connectionOptions({ url: env.KV_DATABASE_URL, tls: env.DATABASE_TLS, caFile: env.DATABASE_CA_FILE }),
  );
  try {
    await connection.query('START TRANSACTION READ ONLY');
    const [rows] = await connection.query<KvRow[]>('SELECT k, v FROM kv_store WHERE k IN (?)', [KV_KEYS]);
    await connection.query('COMMIT');
    return Object.fromEntries(rows.map(row => [row.k, asText(row.v)]));
  } finally {
    await connection.end();
  }
}
