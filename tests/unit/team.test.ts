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
});

/** Reloads team.ts with exactly the variables given, and nothing inherited. */
async function loadWith(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const key of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'MYSQL_TLS', 'NODE_ENV']) vi.stubEnv(key, '');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('@/lib/team');
}

describe('HR connection settings', () => {
  it('falls back to a local server in development, as this file always did', async () => {
    const { findTeamMember } = await loadWith({});
    await findTeamMember('nadia');
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: '127.0.0.1',
      user: 'root',
      database: 'selorax',
      // A local MySQL serves a certificate that can never verify, and nothing crosses a network
      ssl: undefined,
    }));
  });

  it('still verifies in development when pointed at a remote host', async () => {
    const { findTeamMember } = await loadWith({ MYSQL_HOST: 'hr-db.internal', MYSQL_USER: 'reader', MYSQL_DATABASE: 'selorax' });
    await findTeamMember('nadia');
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: { rejectUnauthorized: true } }));
  });

  it('lets an explicit MYSQL_TLS win over the host', async () => {
    const { findTeamMember } = await loadWith({ MYSQL_HOST: 'hr-db.internal', MYSQL_USER: 'r', MYSQL_DATABASE: 'd', MYSQL_TLS: 'off' });
    await findTeamMember('nadia');
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: undefined }));
  });

  it('refuses to guess anything in production', async () => {
    const { findTeamMember } = await loadWith({ NODE_ENV: 'production' });
    // The env schema rejects it first, which is why a production server fails at startup
    // (instrumentation) rather than on the first visitor to reach a profile page.
    await expect(findTeamMember('nadia')).rejects.toThrow(/Required in production/);
    expect(createPool).not.toHaveBeenCalled();
  });

  it('verifies in production even against a local host', async () => {
    const { findTeamMember } = await loadWith({
      NODE_ENV: 'production', MYSQL_HOST: '127.0.0.1', MYSQL_USER: 'reader', MYSQL_DATABASE: 'selorax',
    });
    await findTeamMember('nadia');
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: { rejectUnauthorized: true } }));
  });
});
