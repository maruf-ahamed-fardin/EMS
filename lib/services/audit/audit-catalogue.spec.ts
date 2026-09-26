import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { AUDIT_ACTION_KEYS, AUDIT_ENTITY_TYPES } from '@/lib/validations';
import { AUDIT_FIELDS } from './redaction';

/** Every `action: '…'` and `entityType: '…'` the backend passes to the audit log. */
function written(): { actions: Set<string>; entities: Set<string> } {
  const actions = new Set<string>();
  const entities = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'generated') walk(full);
      } else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
        const source = readFileSync(full, 'utf8');
        for (const m of source.matchAll(/action: '([a-z_]+\.[a-z_]+)'/g)) actions.add(m[1]!);
        for (const m of source.matchAll(/entityType: '([a-z_]+)'/g)) entities.add(m[1]!);
      }
    }
  };
  // The API's source: every module, plus sign-in and sessions
  for (const dir of ['services', 'auth', 'server', 'http']) walk(path.join(__dirname, '..', '..', dir));
  return { actions, entities };
}

describe('audit catalogue', () => {
  const { actions, entities } = written();

  it('names every action the backend records, and nothing it never records', () => {
    expect([...actions].sort()).toEqual([...AUDIT_ACTION_KEYS].sort());
  });

  it('names every kind of record, and each has a redaction allow-list', () => {
    expect([...entities].sort()).toEqual(Object.keys(AUDIT_ENTITY_TYPES).sort());
    for (const entity of entities) expect(AUDIT_FIELDS[entity]).toBeDefined();
  });
});
