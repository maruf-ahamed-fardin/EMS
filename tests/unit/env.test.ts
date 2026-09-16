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

  it('allows DATABASE_URL to be unset until the new database exists', () => {
    expect(parseEnv({}).DATABASE_URL).toBeUndefined();
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

describe('parseEnv in production', () => {
  const prod = {
    NODE_ENV: 'production',
    MYSQL_HOST: 'hr-db.internal',
    MYSQL_USER: 'reader',
    MYSQL_DATABASE: 'selorax',
  };

  it('accepts a complete configuration', () => {
    const env = parseEnv(prod);
    expect(env.MYSQL_PORT).toBe(3306);
    // Left unset on purpose: lib/team.ts resolves it from NODE_ENV and the host
    expect(env.MYSQL_TLS).toBeUndefined();
  });

  it('names every missing HR variable instead of guessing a host', () => {
    let message = '';
    try {
      parseEnv({ NODE_ENV: 'production' });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/MYSQL_HOST/);
    expect(message).toMatch(/MYSQL_USER/);
    expect(message).toMatch(/MYSQL_DATABASE/);
  });

  it('refuses to skip certificate verification', () => {
    expect(() => parseEnv({ ...prod, MYSQL_TLS: 'off' })).toThrow(/MYSQL_TLS/);
    expect(() => parseEnv({ ...prod, DATABASE_TLS: 'off' })).toThrow(/DATABASE_TLS/);
  });

  it('still allows TLS to be off outside production', () => {
    expect(parseEnv({ ...prod, NODE_ENV: 'development', MYSQL_TLS: 'off' }).MYSQL_TLS).toBe('off');
  });

  it('refuses to serve real visitors from a JSON file', () => {
    expect(() => parseEnv({ ...prod, HR_DATA_FILE: 'tests/fixtures/kv-sample.json' })).toThrow(/HR_DATA_FILE/);
    expect(parseEnv({ ...prod, NODE_ENV: 'development', HR_DATA_FILE: 'x.json' }).HR_DATA_FILE).toBe('x.json');
  });

  it('rejects a port that is not a number', () => {
    expect(() => parseEnv({ ...prod, MYSQL_PORT: 'not-a-port' })).toThrow(/MYSQL_PORT/);
  });
});
