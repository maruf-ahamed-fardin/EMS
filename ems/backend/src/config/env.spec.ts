import { InvalidEnvironmentError, parseEnv } from './env';

const SECRET = 's3cr3t-passw0rd';
const base = { DATABASE_URL: `postgresql://ems:${SECRET}@db.internal:5432/ems` };

function problemsOf(env: NodeJS.ProcessEnv): string[] {
  try {
    parseEnv(env);
  } catch (error) {
    if (error instanceof InvalidEnvironmentError) return error.problems;
    throw error;
  }
  throw new Error('expected parseEnv to throw');
}

describe('parseEnv', () => {
  it('applies defaults', () => {
    const config = parseEnv(base);
    expect(config).toMatchObject({ NODE_ENV: 'development', PORT: 4000, LOG_LEVEL: 'info', CORS_ORIGINS: [] });
  });

  it('splits CORS origins', () => {
    const config = parseEnv({ ...base, CORS_ORIGINS: 'http://localhost:3000, http://127.0.0.1:3000,' });
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('names a missing variable', () => {
    expect(problemsOf({})).toContain('DATABASE_URL is required');
  });

  it('rejects a non-postgres URL', () => {
    expect(problemsOf({ DATABASE_URL: `mysql://root:${SECRET}@h/db` })).toEqual([
      'DATABASE_URL must be a postgresql:// URL',
    ]);
  });

  it('requires TLS for the database in production', () => {
    expect(problemsOf({ ...base, NODE_ENV: 'production' })).toEqual([
      'DATABASE_URL needs sslmode=verify-full (or require) in production',
    ]);
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', DATABASE_URL: `${base.DATABASE_URL}?sslmode=verify-full` })).not.toThrow();
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', DATABASE_ALLOW_INSECURE: 'true' })).not.toThrow();
  });

  it('never includes a value in the error', () => {
    for (const env of [
      { NODE_ENV: 'production', DATABASE_URL: base.DATABASE_URL },
      { DATABASE_URL: `mysql://root:${SECRET}@h/db`, PORT: SECRET },
    ]) {
      try {
        parseEnv(env);
      } catch (error) {
        expect(String((error as Error).message)).not.toContain(SECRET);
        continue;
      }
      throw new Error('expected parseEnv to throw');
    }
  });
});
