import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * Loads the repository's `.env` in local development. Containers and CI pass real environment
 * variables instead, and there is no file to find.
 *
 * The file sits at the repository root while this app runs from its workspace folder, so the path
 * between them depends on the layout. Walking up until `.env` turns up keeps that from being a
 * constant that has to be corrected every time a folder moves.
 */
export function loadRepoEnv(from: string = process.cwd()): string | null {
  const { root } = parse(from);
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
        return candidate;
      } catch {
        return null; // unreadable or malformed: fall back to the real environment
      }
    }
    if (dir === root) return null;
  }
}

/**
 * The repository root: the nearest folder at or above `from` that holds yarn.lock, or `from` itself
 * outside a checkout. Relative paths in the configuration (STORAGE_LOCAL_DIR) are resolved against it,
 * because the web app, the seed and the tests each run from a different folder and must agree.
 */
export function repoRoot(from: string = process.cwd()): string {
  const { root } = parse(from);
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'yarn.lock'))) return dir;
    if (dir === root) return from;
  }
}
