import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/server/env';

const base = { DATABASE_URL: 'mysql://app:pw@127.0.0.1:3306/selorax_team' };

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(base);
    expect(env.DATABASE_TLS).toBe('verify');
    expect(env.ALLOWED_ORIGINS).toEqual([]);
    expect(env.KV_DATABASE_URL).toBeUndefined();
  });

  it('splits and trims ALLOWED_ORIGINS', () => {
    const env = parseEnv({ ...base, ALLOWED_ORIGINS: 'https://team.selorax.io, http://localhost:3000,' });
    expect(env.ALLOWED_ORIGINS).toEqual(['https://team.selorax.io', 'http://localhost:3000']);
  });

  it('treats empty values as unset', () => {
    const env = parseEnv({ ...base, KV_DATABASE_URL: '', DATABASE_CA_FILE: '' });
    expect(env.KV_DATABASE_URL).toBeUndefined();
    expect(env.DATABASE_CA_FILE).toBeUndefined();
  });

  it('requires DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-MySQL URL without echoing its password', () => {
    let message = '';
    try {
      parseEnv({ DATABASE_URL: 'postgres://app:hunter2@db/selorax_team' });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain('hunter2');
  });
});
