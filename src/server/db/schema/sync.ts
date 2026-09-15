import { bigint, index, json, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
// Relative, type-only imports: drizzle-kit loads this file without the `@/` alias
import type { SyncIssue, SyncSummary } from '../../modules/sync/plan';
import type { KvKey } from '../../modules/sync/snapshot';
import { dateTime } from './columns';

export const syncRuns = mysqlTable('sync_runs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  status: mysqlEnum('status', ['running', 'applied', 'skipped', 'aborted', 'failed']).notNull(),
  /** sha256 of each kv_store value read. A run is skipped when none changed since the last applied run. */
  sourceHashes: json('source_hashes').$type<Record<KvKey, string | null>>(),
  summary: json('summary').$type<SyncSummary>(),
  conflicts: json('conflicts').$type<SyncIssue[]>(),
  error: varchar('error', { length: 1024 }),
  startedAt: dateTime('started_at').notNull(),
  finishedAt: dateTime('finished_at'),
}, table => [index('sync_runs_started_at_idx').on(table.startedAt)]);
