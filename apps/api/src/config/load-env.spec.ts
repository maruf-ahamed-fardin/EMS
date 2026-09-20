import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRepoEnv } from './load-env';

/**
 * The API runs from its workspace folder while `.env` sits at the repository root, so the distance
 * between them changes whenever the layout does — moving `backend/` to `apps/api/` broke a
 * hard-coded `../.env` and left the API unable to start.
 *
 * These assert on the path found, not on `process.env`: `process.loadEnvFile` writes to the real
 * process environment, which Jest's per-file copy of `process.env` never sees. Reading the file is
 * Node's own job; finding it is ours, and finding it is what broke.
 */
describe('loadRepoEnv', () => {
  function repoWithEnv(depth: number): { root: string; start: string } {
    const root = mkdtempSync(join(tmpdir(), 'ems-env-'));
    writeFileSync(join(root, '.env'), 'EMS_TEST_KEY=found\n');
    let start = root;
    for (let i = 0; i < depth; i++) {
      start = join(start, `level${i}`);
      mkdirSync(start);
    }
    return { root, start };
  }

  it('finds the file however deep the workspace sits', () => {
    for (const depth of [0, 1, 2, 4]) {
      const { root, start } = repoWithEnv(depth);
      expect(loadRepoEnv(start)).toBe(join(root, '.env'));
    }
  });

  it('returns null when there is no file, so the real environment is used instead', () => {
    const nowhere = mkdtempSync(join(tmpdir(), 'ems-noenv-'));
    expect(loadRepoEnv(nowhere)).toBeNull();
  });

  it('takes the nearest file when more than one is above it', () => {
    const { start: inner } = repoWithEnv(1);
    writeFileSync(join(inner, '.env'), 'EMS_TEST_KEY=inner\n');

    expect(loadRepoEnv(inner)).toBe(join(inner, '.env'));
  });
});
