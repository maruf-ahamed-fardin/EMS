#!/usr/bin/env node
// Fails when a config or source file hides code after a long run of spaces, the pattern the
// PolinRider loader used in SeloraX repos in September 2026 (docs/architecture.md, "Dependencies").
// It checks this workspace's own files, not node_modules.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'generated']);
const EXTENSIONS = /\.(?:[cm]?[jt]sx?|json|ya?ml|css|prisma|sql)$/;
const HIDDEN_CODE = / {100,}\S/;

const findings = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(path);
    } else if (EXTENSIONS.test(name) && name !== 'package-lock.json') {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (HIDDEN_CODE.test(line)) findings.push(`${relative(root, path)}:${index + 1}`);
      });
    }
  }
}

walk(root);

if (findings.length > 0) {
  console.error('Hidden code after a long run of spaces (possible PolinRider payload):');
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log('No hidden payload pattern found.');
