import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql, { type Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/server/db/client';
import { connectionOptions } from '@/server/db/connection';
import * as schema from '@/server/db/schema';
import { loadCurrentMembers } from '@/server/modules/sync/current';

// Runs against a real MySQL 8 when TEST_DATABASE_URL is set (CI provides one), e.g.
// mysql://root@127.0.0.1:3307/teamprofile_test. That database is dropped and recreated each run.
const url = process.env.TEST_DATABASE_URL;

/** mysql2's error code, whether or not drizzle wrapped the error */
function mysqlCode(error: unknown): unknown {
  const { cause } = error as { cause?: { code?: unknown } };
  return cause?.code ?? (error as { code?: unknown }).code;
}

describe.skipIf(!url)('database', () => {
  let pool: Pool;
  let db: Db;

  beforeAll(async () => {
    const target = new URL(url!);
    const name = target.pathname.slice(1);
    if (!/^\w*test\w*$/.test(name)) throw new Error('TEST_DATABASE_URL must name a database with "test" in it');

    target.pathname = '/';
    const admin = await mysql.createConnection(connectionOptions({ url: target.href, tls: 'off' }));
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await admin.end();

    pool = mysql.createPool({ ...connectionOptions({ url: url!, tls: 'off' }), connectionLimit: 2 });
    db = drizzle({ client: pool, schema, mode: 'default' });
    await migrate(db, { migrationsFolder: 'drizzle' });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('treats usernames that differ only in case as the same', async () => {
    await db.insert(schema.members).values({ id: '01J0000000000000000000000A', username: 'ashekrabbani', source: 'hr' });
    const duplicate = db.insert(schema.members).values({ id: '01J0000000000000000000000B', username: 'AshekRabbani', source: 'hr' });
    const error = await duplicate.then(() => null, (e: unknown) => e);
    expect(mysqlCode(error)).toBe('ER_DUP_ENTRY');
  });

  it('loads members with their profile and photo for the sync planner', async () => {
    const id = '01J0000000000000000000000C';
    const sourceHash = 'a'.repeat(64);
    await db.insert(schema.members).values({ id, username: 'longname', hrEmployeeId: 'SX-002', name: 'Long Name', source: 'hr' });
    await db.insert(schema.memberProfiles).values({ memberId: id, legacyPhone: '+8801911222333', portfolio: 'longname.design' });
    await db.insert(schema.memberAvatars).values({ memberId: id, externalUrl: 'https://invalid.invalid/broken.jpg', sourceHash });

    const loaded = (await loadCurrentMembers(db)).find(member => member.id === id);
    expect(loaded).toEqual({
      id,
      username: 'longname',
      hrEmployeeId: 'SX-002',
      name: 'Long Name',
      jobRole: null,
      designation: null,
      status: 'active',
      source: 'hr',
      profileClaimed: false,
      profile: {
        email: null, personalPhone: null, businessPhone: null, whatsapp: null, legacyPhone: '+8801911222333',
        facebook: null, instagram: null, github: null, portfolio: 'longname.design',
      },
      avatarSourceHash: sourceHash,
    });
  });

  it("deletes a member's profile along with the member", async () => {
    const id = '01J0000000000000000000000D';
    await db.insert(schema.members).values({ id, username: 'gone', source: 'manual' });
    await db.insert(schema.memberProfiles).values({ memberId: id, email: 'gone@selorax.io' });
    await db.delete(schema.members).where(eq(schema.members.id, id));
    expect(await db.select().from(schema.memberProfiles).where(eq(schema.memberProfiles.memberId, id))).toEqual([]);
  });
});
