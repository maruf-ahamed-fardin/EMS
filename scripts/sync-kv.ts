// Plans a one-way sync from the HR app's kv_store into this backend's members and prints what would change.
//
//   npm run sync:kv -- --dry-run                  read kv_store through KV_DATABASE_URL
//   npm run sync:kv -- --dry-run --file kv.json   read an export instead: {"sharedUsers": [...], "profilePics": {...}, ...}
//
// Current members come from DATABASE_URL when it's set; otherwise the plan is against an empty table.
// Exits 1 when the circuit breaker trips (override with --force) or the HR data is unusable.
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getDb } from '@/server/db/client';
import { getEnv } from '@/server/env';
import { loadCurrentMembers } from '@/server/modules/sync/current';
import { readKvStore } from '@/server/modules/sync/kv-source';
import { planSync } from '@/server/modules/sync/plan';
import { formatPlan } from '@/server/modules/sync/report';
import { KV_KEYS, SnapshotError, parseSnapshot, type KvValues } from '@/server/modules/sync/snapshot';

// Same file Next.js reads; the env is parsed lazily, so loading it here is early enough
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    file: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

function readExport(path: string): KvValues {
  const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  return Object.fromEntries(KV_KEYS.filter(key => key in data).map(key => [key, JSON.stringify(data[key])]));
}

async function main(): Promise<number> {
  if (!args['dry-run']) {
    console.error('Applying changes is not available yet. Run with --dry-run to see the plan.');
    return 2;
  }

  const snapshot = parseSnapshot(args.file ? readExport(args.file) : await readKvStore(getEnv()));
  const hasDb = Boolean(process.env.DATABASE_URL);
  if (!hasDb) console.log('DATABASE_URL is not set, so this plans against an empty members table.\n');
  const plan = planSync(snapshot, hasDb ? await loadCurrentMembers(getDb()) : []);

  console.log(formatPlan(plan));
  return plan.breaker.tripped && !args.force ? 1 : 0;
}

main().then(
  code => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof SnapshotError ? `Sync aborted: ${error.message}` : error);
    process.exit(1);
  },
);
