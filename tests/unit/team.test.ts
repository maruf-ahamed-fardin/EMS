import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const createPool = vi.fn(() => ({ execute }));

vi.mock('mysql2/promise', () => ({ default: { createPool } }));

const SHARED_USERS = [
  {
    username: 'AshekRabbani',
    name: 'Ashek Rabbani',
    role: 'Engineering',
    designation: 'Backend Engineer',
    employeeId: 'SX-001',
    // Everything below is private and must never reach the browser
    password: 'hunter2',
    passwordHash: '$2b$10$abcdefghijklmnop',
    salary: 120000,
    nid: '1234567890',
    address: '12 Green Road, Dhaka',
  },
  { username: 'nadia', name: 'Nadia Islam', employeeId: 'SX-002' },
];

const PROFILE_PICS = { AshekRabbani: 'https://cdn.selorax.io/a.webp' };
const SHARED_PROFILES = { AshekRabbani: { email: 'ashek@selorax.io', socials: { github: 'https://github.com/ashek' } } };

function kvRows(data: Record<string, unknown> = {
  sharedUsers: SHARED_USERS, profilePics: PROFILE_PICS, sharedProfiles: SHARED_PROFILES,
}) {
  return [Object.entries(data).map(([k, v]) => ({ k, v: JSON.stringify(v) }))];
}

/** Fresh module graph per test: team.ts caches the pool and the kv_store read for 30s. */
async function loadTeam(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv('MYSQL_HOST', '127.0.0.1');
  vi.stubEnv('MYSQL_USER', 'reader');
  vi.stubEnv('MYSQL_DATABASE', 'selorax');
  vi.stubEnv('MYSQL_TLS', 'off');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('@/lib/team');
}

beforeEach(() => {
  vi.unstubAllEnvs();
  execute.mockReset();
  createPool.mockClear();
  execute.mockResolvedValue(kvRows());
});

describe('findTeamMember', () => {
  it('returns only the public fields, never credentials or salary', async () => {
    const { findTeamMember } = await loadTeam();
    const member = await findTeamMember('AshekRabbani');

    expect(member?.user).toEqual({
      username: 'AshekRabbani',
      name: 'Ashek Rabbani',
      role: 'Engineering',
      designation: 'Backend Engineer',
      employeeId: 'SX-001',
    });
    // Belt and braces: nothing private survives serialisation either
    const serialised = JSON.stringify(member);
    for (const secret of ['hunter2', '$2b$10$', '120000', '1234567890', 'Green Road']) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('matches a username regardless of letter case, without redirecting', async () => {
    const { findTeamMember } = await loadTeam();
    const member = await findTeamMember('ashekrabbani');
    expect(member?.user.username).toBe('AshekRabbani');
    expect(member?.redirectTo).toBeNull();
  });

  it('redirects an employee ID to the username URL', async () => {
    const { findTeamMember } = await loadTeam();
    const member = await findTeamMember('sx-001');
    expect(member?.redirectTo).toBe('AshekRabbani');
  });

  it('attaches the photo and profile stored under the username', async () => {
    const { findTeamMember } = await loadTeam();
    const member = await findTeamMember('AshekRabbani');
    expect(member?.profilePic).toBe('https://cdn.selorax.io/a.webp');
    expect(member?.profileData?.email).toBe('ashek@selorax.io');
  });

  it('returns nulls when a member has no photo or profile', async () => {
    const { findTeamMember } = await loadTeam();
    const member = await findTeamMember('nadia');
    expect(member?.profilePic).toBeNull();
    expect(member?.profileData).toBeNull();
  });

  it('returns null for an unknown id and for an empty one', async () => {
    const { findTeamMember } = await loadTeam();
    expect(await findTeamMember('nobody')).toBeNull();
    expect(await findTeamMember('')).toBeNull();
  });

  it('reads kv_store once for concurrent lookups', async () => {
    const { findTeamMember } = await loadTeam();
    await Promise.all([findTeamMember('nadia'), findTeamMember('AshekRabbani'), findTeamMember('SX-002')]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed read', async () => {
    const { findTeamMember } = await loadTeam();
    execute.mockRejectedValueOnce(new Error('connection lost'));
    await expect(findTeamMember('nadia')).rejects.toThrow('connection lost');

    execute.mockResolvedValue(kvRows());
    expect(await findTeamMember('nadia')).not.toBeNull();
  });

  it('survives a kv_store value that is not JSON', async () => {
    const { findTeamMember } = await loadTeam();
    execute.mockResolvedValue([[{ k: 'sharedUsers', v: 'not json' }]]);
    expect(await findTeamMember('nadia')).toBeNull();
  });

  it('verifies the server certificate by default', async () => {
    const { findTeamMember } = await loadTeam({ MYSQL_TLS: 'verify' });
    await findTeamMember('nadia');
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: { rejectUnauthorized: true } }));
  });

  it('refuses to guess a host when the HR database is not configured', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('MYSQL_HOST', '');
    vi.stubEnv('MYSQL_USER', '');
    vi.stubEnv('MYSQL_DATABASE', '');
    const { findTeamMember } = await import('@/lib/team');
    await expect(findTeamMember('nadia')).rejects.toThrow(/HR database is not configured/);
    expect(createPool).not.toHaveBeenCalled();
  });
});
