import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readAvatar } from '@/server/modules/sync/avatar';
import { planSync, type CurrentMember, type SyncAction } from '@/server/modules/sync/plan';
import { SnapshotError, parseSnapshot, type KvValues } from '@/server/modules/sync/snapshot';

interface KvExport {
  sharedUsers: Record<string, unknown>[];
  profilePics: Record<string, string>;
  sharedProfiles: Record<string, unknown>;
}

const fixture = JSON.parse(readFileSync(new URL('../fixtures/kv-sample.json', import.meta.url), 'utf8')) as KvExport;

const kv = (data: Partial<Record<string, unknown>>): KvValues =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, JSON.stringify(value)]));

const snapshot = (overrides: Partial<KvExport> = {}) => parseSnapshot(kv({ ...fixture, ...overrides }));

/** Members as they'd exist after applying a plan's creates */
const membersFrom = (actions: SyncAction[]): CurrentMember[] =>
  actions.flatMap((action, index): CurrentMember[] =>
    action.type === 'create'
      ? [{
        id: `m${index}`,
        ...action.fields,
        status: 'active',
        source: 'hr',
        profileClaimed: false,
        profile: action.profile,
        avatarSourceHash: action.avatar?.sourceHash ?? null,
      }]
      : []);

const imported = () => membersFrom(planSync(snapshot(), []).actions);

const withUsers = (edit: (users: Record<string, unknown>[]) => Record<string, unknown>[]) =>
  snapshot({ sharedUsers: edit(fixture.sharedUsers) });

describe('parseSnapshot', () => {
  it('keeps only public user fields', () => {
    const { users } = snapshot();
    expect(JSON.stringify(users)).not.toMatch(/LEAKCHECK|password|salary|99999/);
    expect(users[0]).toEqual({
      username: 'ashekrabbani', name: 'Ashek Rabbani', designation: 'Software Engineer', role: 'admin', employeeId: 'SX-001',
    });
  });

  it.each([
    ['missing', {}],
    ['not JSON', { sharedUsers: '{oops' }],
    ['not a list', { sharedUsers: '{"a":1}' }],
    ['empty', { sharedUsers: '[]' }],
  ])('refuses sharedUsers that is %s', (_label, values) => {
    expect(() => parseSnapshot(values)).toThrow(SnapshotError);
  });

  it('names profile fields it does not import', () => {
    const parsed = parseSnapshot(kv({
      sharedUsers: [{ username: 'a' }],
      sharedProfiles: { a: { email: 'a@b.co', salary: 1, socials: { tiktok: 'x' } } },
    }));
    expect(parsed.unknownProfileFields).toEqual(['salary', 'socials.tiktok']);
  });

  it('reads numeric employee IDs as text', () => {
    const parsed = parseSnapshot(kv({ sharedUsers: [{ username: 'a', employeeId: 42 }] }));
    expect(parsed.users[0]?.employeeId).toBe('42');
  });
});

describe('readAvatar', () => {
  it('accepts an embedded PNG and measures it', () => {
    const result = readAvatar(`data:image/png;base64,${Buffer.alloc(300).toString('base64')}`);
    expect(result).toMatchObject({ avatar: { kind: 'data', mimeType: 'image/png', bytes: 300 } });
  });

  it.each([
    ['SVG', "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>"],
    ['plain http link', 'http://example.com/me.jpg'],
    ['image over 2MB', `data:image/jpeg;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')}`],
    ['script URL', 'javascript:alert(1)'],
  ])('rejects a %s', (_label, value) => {
    expect(readAvatar(value)).toHaveProperty('rejected');
  });
});

describe('planSync', () => {
  it('imports everyone on the first run', () => {
    const plan = planSync(snapshot(), []);
    expect(plan.summary).toMatchObject({ hrRecords: 3, created: 3, conflicts: 0 });
    expect(plan.breaker.tripped).toBe(false);

    const created = Object.fromEntries(plan.actions.flatMap(a => (a.type === 'create' ? [[a.fields.username, a]] : [])));
    expect(created.ashekrabbani).toMatchObject({
      fields: { hrEmployeeId: 'SX-001', jobRole: 'admin', designation: 'Software Engineer' },
      profile: { github: 'github.com/ashek', facebook: null, personalPhone: '+8801711000000' },
      avatar: null,
    });
    expect(created.longname).toMatchObject({
      profile: { personalPhone: null, legacyPhone: '+8801911222333', portfolio: 'longname.design' },
      avatar: { kind: 'external', url: 'https://invalid.invalid/broken.jpg' },
    });
    expect(created.nocontact).toMatchObject({ profile: null, avatar: null });

    expect(plan.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'avatar-rejected', subject: 'ashekrabbani' }),
      expect.objectContaining({ code: 'dropped-field', subject: 'ashekrabbani', detail: expect.stringContaining('facebook') }),
    ]));
  });

  it('changes nothing when nothing changed in HR', () => {
    expect(planSync(snapshot(), imported()).actions).toEqual([]);
  });

  it('follows a rename by employee ID', () => {
    const plan = planSync(withUsers(users => users.map(u => (u.employeeId === 'SX-003' ? { ...u, username: 'nadia' } : u))), imported());
    expect(plan.actions).toEqual([expect.objectContaining({ type: 'update', username: 'nocontact', changes: { username: 'nadia' } })]);
    expect(plan.summary.renamed).toBe(1);
  });

  it('deactivates members who left HR, and reactivates them when they return', () => {
    const current = imported();
    const leaving = planSync(withUsers(users => users.filter(u => u.username !== 'nocontact')), current);
    expect(leaving.actions).toEqual([expect.objectContaining({ type: 'deactivate', username: 'nocontact' })]);

    const inactive = current.map(m => (m.username === 'nocontact' ? { ...m, status: 'inactive' as const } : m));
    const returning = planSync(snapshot(), inactive);
    expect(returning.actions).toEqual([expect.objectContaining({ type: 'update', username: 'nocontact', reactivate: true, changes: {} })]);
  });

  it("applies HR fields but not contacts once a member has claimed their profile", () => {
    const current = imported().map(m => (m.username === 'ashekrabbani' ? { ...m, profileClaimed: true, profile: null } : m));
    const plan = planSync(withUsers(users => users.map(u => (u.username === 'ashekrabbani' ? { ...u, designation: 'CTO' } : u))), current);
    expect(plan.actions).toEqual([expect.objectContaining({ type: 'update', username: 'ashekrabbani', changes: { designation: 'CTO' } })]);
  });

  it('copies contact changes while the profile is unclaimed', () => {
    const plan = planSync(snapshot({ sharedProfiles: { ...fixture.sharedProfiles, nocontact: { email: 'nadia@selorax.io' } } }), imported());
    expect(plan.actions).toEqual([expect.objectContaining({ type: 'profile', username: 'nocontact', changed: ['email'] })]);
  });

  it('never touches a manually added member', () => {
    const manual: CurrentMember = {
      id: 'manual1', username: 'nocontact', hrEmployeeId: null, name: 'Nadia', jobRole: null, designation: null,
      status: 'active', source: 'manual', profileClaimed: true, profile: null, avatarSourceHash: null,
    };
    const plan = planSync(snapshot(), [manual]);
    expect(plan.conflicts).toEqual([expect.objectContaining({ code: 'manual-member', subject: 'nocontact' })]);
    expect(plan.actions.some(a => 'memberId' in a && a.memberId === 'manual1')).toBe(false);
  });

  it('skips duplicated employee IDs without deactivating the member', () => {
    const plan = planSync(withUsers(users => [...users, { username: 'impostor', employeeId: 'sx-001' }]), imported());
    expect(plan.conflicts.map(c => [c.code, c.subject])).toEqual([
      ['duplicate-employee-id', 'ashekrabbani'],
      ['duplicate-employee-id', 'impostor'],
    ]);
    expect(plan.actions).toEqual([]);
  });

  it('refuses usernames that collide with site pages', () => {
    const plan = planSync(withUsers(users => [...users, { username: 'Admin', employeeId: 'SX-099' }]), []);
    expect(plan.conflicts).toEqual([expect.objectContaining({ code: 'reserved-username', subject: 'Admin' })]);
  });

  it('trips the circuit breaker when too many members would change', () => {
    const team = Array.from({ length: 10 }, (_, i) => ({ username: `member${i}`, employeeId: `SX-${100 + i}` }));
    const current = membersFrom(planSync(parseSnapshot(kv({ sharedUsers: team })), []).actions);

    const threeLeft = planSync(parseSnapshot(kv({ sharedUsers: team.slice(0, 7) })), current);
    expect(threeLeft.breaker).toEqual({ tripped: true, changed: 3, limit: 2 });

    const twoLeft = planSync(parseSnapshot(kv({ sharedUsers: team.slice(0, 8) })), current);
    expect(twoLeft.breaker.tripped).toBe(false);
  });
});
