import { FORGOT_PASSWORD_MESSAGE } from '@ems/contracts';
import { hashToken } from '../src/common/security/tokens';
import { DEMO_PEOPLE } from '../prisma/demo-data';
import { DEMO_PASSWORD, describeWithDatabase, type TestApp, TestBrowser, startTestApp } from './support/test-app';

const employee = DEMO_PEOPLE.employee.email;
const manager = DEMO_PEOPLE.manager.email;
let ipCounter = 0;
const freshIp = () => `192.0.2.${(ipCounter = (ipCounter % 250) + 1)}`;

describeWithDatabase('authentication', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  afterEach(async () => {
    // Keep tests independent: unlock and reactivate the demo accounts
    await t.prisma.user.updateMany({ data: { failedLoginCount: 0, lockedUntil: null, status: 'ACTIVE' } });
  });

  describe('login', () => {
    it('signs in, sets an httpOnly session cookie and stores only its hash', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      const res = await browser.login(manager);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ email: manager, role: { key: 'manager' } });

      const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ems_session='));
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);

      const token = browser.sessionCookie(res);
      expect(token).toBeDefined();
      expect(await t.prisma.session.count({ where: { tokenHash: token } })).toBe(0);
      expect(await t.prisma.session.count({ where: { tokenHash: hashToken(token!) } })).toBe(1);

      await browser.get('/auth/me').expect(200);
    });

    it('treats email case-insensitively', async () => {
      const res = await new TestBrowser(t.app, freshIp()).login(manager.toUpperCase());
      expect(res.status).toBe(200);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrong = await new TestBrowser(t.app, freshIp()).login(employee, 'not-the-password-1');
      const unknown = await new TestBrowser(t.app, freshIp()).login('nobody@demo.selorax.test', 'not-the-password-1');
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.message).toBe('Email or password is incorrect');
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('refuses an inactive user with the same message', async () => {
      await t.prisma.user.update({ where: { email: employee }, data: { status: 'INACTIVE' } });
      const res = await new TestBrowser(t.app, freshIp()).login(employee);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Email or password is incorrect');
    });

    it('locks the account after 10 failures, even from different IPs', async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await new TestBrowser(t.app, freshIp()).login(employee, `wrong-password-${attempt}`);
        expect(res.status).toBe(401);
      }
      const locked = await new TestBrowser(t.app, freshIp()).login(employee);
      expect(locked.status).toBe(401);
      expect(locked.body.message).toBe('Email or password is incorrect');

      const user = await t.prisma.user.findUniqueOrThrow({ where: { email: employee } });
      expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);

      // After the lock expires, the right password works again
      await t.prisma.user.update({ where: { email: employee }, data: { lockedUntil: new Date(Date.now() - 1000) } });
      expect((await new TestBrowser(t.app, freshIp()).login(employee)).status).toBe(200);
    });

    it('rate limits one IP and email to 5 attempts a minute', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        statuses.push((await browser.login('throttle-me@demo.selorax.test', 'wrong-password-x')).status);
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    });

    it('rate limits one IP to 30 sign-ins a minute however many emails it tries', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 31; attempt++) {
        statuses.push((await browser.login(`spray-${attempt}@demo.selorax.test`, 'wrong-password-x')).status);
      }
      expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
      expect(statuses[30]).toBe(429);
    });

    it('audits sign-ins without secrets', async () => {
      await new TestBrowser(t.app, freshIp()).login(manager);
      const rows = await t.prisma.auditLog.findMany({ where: { action: { startsWith: 'auth.' } } });
      expect(rows.some((row) => row.action === 'auth.login')).toBe(true);
      expect(rows.some((row) => row.action === 'auth.login_failed')).toBe(true);
      expect(JSON.stringify(rows)).not.toContain(DEMO_PASSWORD);
      expect(JSON.stringify(rows)).not.toMatch(/\$argon2|tokenHash/);
    });
  });

  describe('sessions', () => {
    it('logs out and revokes the session server-side', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      const login = await browser.login(manager);
      const token = browser.sessionCookie(login)!;

      await browser.post('/auth/logout').then((res) => expect(res.status).toBe(204));
      const session = await t.prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
      expect(session.revokedAt).not.toBeNull();

      // Replaying the old cookie doesn't work
      const replay = new TestBrowser(t.app, freshIp());
      await replay.agent.get('/api/v1/auth/me').set('cookie', `ems_session=${token}`).expect(401);
    });

    it('rejects a session idle for more than 8 hours', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      const token = browser.sessionCookie(await browser.login(manager))!;
      await t.prisma.session.update({
        where: { tokenHash: hashToken(token) },
        data: { lastSeenAt: new Date(Date.now() - 8 * 60 * 60 * 1000 - 1000) },
      });
      await browser.get('/auth/me').expect(401);
    });

    it("rejects a deactivated user's existing session", async () => {
      const browser = new TestBrowser(t.app, freshIp());
      await browser.login(employee);
      await browser.get('/auth/me').expect(200);
      await t.prisma.user.update({ where: { email: employee }, data: { status: 'INACTIVE' } });
      await browser.get('/auth/me').expect(401);
    });

    it('signs out other devices but keeps the current one', async () => {
      const laptop = new TestBrowser(t.app, freshIp());
      const phone = new TestBrowser(t.app, freshIp());
      await laptop.login(manager);
      await phone.login(manager);

      const res = await laptop.post('/auth/logout-others');
      expect(res.status).toBe(200);
      expect(res.body.data.sessionsRevoked).toBeGreaterThanOrEqual(1);
      await laptop.get('/auth/me').expect(200);
      await phone.get('/auth/me').expect(401);
    });
  });

  describe('forgot and reset password', () => {
    it('answers the same for known and unknown emails, and only mails a known one', async () => {
      t.mailer.sent.length = 0;
      const known = await new TestBrowser(t.app, freshIp()).post('/auth/forgot-password', { email: employee });
      const unknown = await new TestBrowser(t.app, freshIp()).post('/auth/forgot-password', { email: 'ghost@demo.selorax.test' });
      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual({ data: { message: FORGOT_PASSWORD_MESSAGE } });
      expect(unknown.body).toEqual(known.body);

      await waitFor(() => t.mailer.sent.length === 1);
      expect(t.mailer.sent[0]?.to).toBe(employee);
    });

    it('resets with a valid link once, signs out everywhere, and the new password works', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      await browser.login(employee);

      t.mailer.sent.length = 0;
      await new TestBrowser(t.app, freshIp()).post('/auth/forgot-password', { email: employee });
      await waitFor(() => t.mailer.sent.length === 1);
      const link = t.mailer.sent[0]!.text.match(/https?:\/\/\S+/)![0];
      const token = new URL(link).searchParams.get('token')!;
      expect(link.startsWith('http://localhost:3000/reset-password?token=')).toBe(true);

      const weak = await new TestBrowser(t.app, freshIp()).post('/auth/reset-password', { token, password: 'password123' });
      expect(weak.status).toBe(422);
      expect(weak.body.errors).toEqual({ password: 'This password is too common. Choose something harder to guess.' });

      const newPassword = 'harbour-meadow-cobalt-9';
      const reset = await new TestBrowser(t.app, freshIp()).post('/auth/reset-password', { token, password: newPassword });
      expect(reset.status).toBe(204);

      await browser.get('/auth/me').expect(401);
      expect((await new TestBrowser(t.app, freshIp()).login(employee, newPassword)).status).toBe(200);

      const reuse = await new TestBrowser(t.app, freshIp()).post('/auth/reset-password', { token, password: 'another-fresh-pass-5' });
      expect(reuse.status).toBe(422);

      // Put the demo password back for the other tests
      await t.prisma.user.update({
        where: { email: employee },
        data: { passwordHash: (await t.prisma.user.findUniqueOrThrow({ where: { email: manager } })).passwordHash },
      });
    });

    it('refuses an expired link', async () => {
      t.mailer.sent.length = 0;
      await new TestBrowser(t.app, freshIp()).post('/auth/forgot-password', { email: manager });
      await waitFor(() => t.mailer.sent.length === 1);
      const token = new URL(t.mailer.sent[0]!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
      await t.prisma.passwordResetToken.update({ where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await new TestBrowser(t.app, freshIp()).post('/auth/reset-password', { token, password: 'harbour-meadow-cobalt-9' });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/invalid or has expired/);
    });
  });

  describe('change password', () => {
    it('needs the current password', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      await browser.login(manager);
      const res = await browser.post('/auth/change-password', { currentPassword: 'wrong-current-1', newPassword: 'orchard-violet-maple-3' });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual({ currentPassword: 'Your current password is incorrect' });
    });

    it('limits guesses to 10 an hour per session, even with a made-up email in the body', async () => {
      const browser = new TestBrowser(t.app, freshIp());
      await browser.login(manager);
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 11; attempt++) {
        const res = await browser.post('/auth/change-password', { currentPassword: 'wrong-current-1', newPassword: 'orchard-violet-maple-3', email: `bucket-${attempt}@example.com` });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 10)).not.toContain(429);
      expect(statuses[10]).toBe(429);
    });

    it('changes it and signs out other sessions only', async () => {
      const current = new TestBrowser(t.app, freshIp());
      const other = new TestBrowser(t.app, freshIp());
      await current.login(DEMO_PEOPLE.hr_admin.email);
      await other.login(DEMO_PEOPLE.hr_admin.email);

      const res = await current.post('/auth/change-password', { currentPassword: DEMO_PASSWORD, newPassword: 'orchard-violet-maple-3' });
      expect(res.status).toBe(204);
      await current.get('/auth/me').expect(200);
      await other.get('/auth/me').expect(401);
    });
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
