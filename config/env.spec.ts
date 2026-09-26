import { InvalidEnvironmentError, parseEnv } from './env';

const SECRET = 's3cr3t-passw0rd';
const base = { DATABASE_URL: `postgresql://ems:${SECRET}@db.internal:5432/ems` };

function problemsOf(env: Record<string, string | undefined>): string[] {
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
    const production = {
      ...base,
      NODE_ENV: 'production',
      APP_URL: 'https://ems.selorax.io',
      MAIL_DRIVER: 'smtp',
      SMTP_URL: 'smtps://mailer.example:465',
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'ems-documents',
    };
    expect(problemsOf(production)).toEqual(['DATABASE_URL needs sslmode=verify-full (or require) in production']);
    expect(() => parseEnv({ ...production, DATABASE_URL: `${base.DATABASE_URL}?sslmode=verify-full` })).not.toThrow();
    expect(() => parseEnv({ ...production, DATABASE_ALLOW_INSECURE: 'true' })).not.toThrow();
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

describe('parseEnv (auth and mail)', () => {
  it('reduces APP_URL to its origin', () => {
    expect(parseEnv({ ...base, APP_URL: 'http://localhost:3000/some/path' }).APP_URL).toBe('http://localhost:3000');
  });

  it('requires https, smtp and TLS together in production', () => {
    expect(problemsOf({ ...base, NODE_ENV: 'production', DATABASE_ALLOW_INSECURE: 'true', APP_URL: 'http://ems.example' })).toEqual([
      'APP_URL must be https in production',
      'MAIL_DRIVER must be smtp in production',
      'STORAGE_DRIVER must be s3 in production',
    ]);
  });

  it('needs an SMTP URL when mail goes over SMTP', () => {
    expect(problemsOf({ ...base, MAIL_DRIVER: 'smtp' })).toEqual([
      'SMTP_URL must be an smtp:// or smtps:// URL when MAIL_DRIVER=smtp',
    ]);
  });
});

describe('parseEnv (document storage)', () => {
  it('keeps documents on local disk by default', () => {
    expect(parseEnv(base)).toMatchObject({ STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: './storage' });
  });

  it('needs a bucket, and both keys or neither, for S3', () => {
    expect(problemsOf({ ...base, STORAGE_DRIVER: 's3', S3_ACCESS_KEY_ID: 'AKIA' })).toEqual([
      'S3_BUCKET is required when STORAGE_DRIVER=s3',
      'S3_SECRET_ACCESS_KEY and S3_ACCESS_KEY_ID must be set together',
    ]);
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: 's3', S3_BUCKET: 'docs' })).not.toThrow();
  });

  it('never shows the S3 secret in an error', () => {
    try {
      parseEnv({ ...base, STORAGE_DRIVER: 's3', S3_SECRET_ACCESS_KEY: SECRET, S3_ENDPOINT: SECRET });
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(SECRET);
      return;
    }
    throw new Error('expected parseEnv to throw');
  });
});
