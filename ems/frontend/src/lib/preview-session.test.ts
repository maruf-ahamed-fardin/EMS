import { DEFAULT_ROLE_GRANTS } from '@ems/contracts';

describe('preview session', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('builds a session with the role’s default permissions', async () => {
    const { previewSessionFor, previewToken } = await import('./preview-session');
    const session = previewSessionFor(previewToken('manager'));
    expect(session).toMatchObject({ roleKey: 'manager', roleName: 'Manager', preview: true });
    expect(session?.permissions).toEqual(DEFAULT_ROLE_GRANTS.manager);
  });

  it('rejects unknown roles and other tokens', async () => {
    const { previewSessionFor } = await import('./preview-session');
    expect(previewSessionFor('preview.owner')).toBeNull();
    expect(previewSessionFor('preview.__proto__')).toBeNull();
    expect(previewSessionFor('a-real-session-token')).toBeNull();
  });

  it('is refused in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { previewSessionFor, PREVIEW_ENABLED } = await import('./preview-session');
    expect(PREVIEW_ENABLED).toBe(false);
    expect(previewSessionFor('preview.super_admin')).toBeNull();
  });
});
