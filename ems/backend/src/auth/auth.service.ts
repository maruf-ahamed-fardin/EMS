import { Inject, Injectable, Logger, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import type { ChangePasswordInput, LoginInput, MeResponse, ResetPasswordInput } from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import { generateToken, hashToken } from '../common/security/tokens';
import { InjectConfig, type AppConfig } from '../config/config.module';
import { MAILER, type Mailer } from '../mail/mailer';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './auth-context';
import { PasswordService } from './password.service';
import { PermissionsService } from './permissions.service';
import { LOCKOUT_DURATION_MS, LOCKOUT_THRESHOLD, RESET_TOKEN_TTL_MS } from './session-policy';
import { displayName, SessionsService } from './sessions.service';

/** One message for every failed sign-in, so it never reveals which accounts exist or are locked. */
export const LOGIN_FAILED = 'Email or password is incorrect';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** Returns the new session token and who signed in. Throws 401 with LOGIN_FAILED otherwise. */
  async login(input: LoginInput, meta: RequestMeta): Promise<{ token: string; me: MeResponse }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        lockedUntil: true,
        employee: { select: { status: true, deletedAt: true } },
      },
    });

    // Always verify, even without an account, so both paths take the same time
    const passwordOk = await this.passwords.verify(user?.passwordHash ?? null, input.password);

    if (!user) {
      await this.audit.record({ action: 'auth.login_failed', entityType: 'user', after: { email: input.email, reason: 'unknown_email' } });
      throw new UnauthorizedException(LOGIN_FAILED);
    }

    const now = new Date();
    const locked = user.lockedUntil !== null && user.lockedUntil > now;
    const employeeInactive = user.employee !== null && (user.employee.status !== 'ACTIVE' || user.employee.deletedAt !== null);
    const blockedReason = locked ? 'locked' : user.status !== 'ACTIVE' || employeeInactive ? 'inactive' : null;

    if (!passwordOk || blockedReason) {
      await this.recordFailure(user.id, user.email, blockedReason ?? 'wrong_password', !passwordOk && !locked);
      throw new UnauthorizedException(LOGIN_FAILED);
    }

    const token = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
          ...(this.passwords.needsRehash(user.passwordHash) ? { passwordHash: await this.passwords.hash(input.password) } : {}),
        },
      });
      const sessionToken = await this.sessions.create(user.id, meta, tx);
      await this.audit.record({ action: 'auth.login', entityType: 'user', entityId: user.id, actorUserId: user.id }, tx);
      return sessionToken;
    });

    return { token, me: await this.me(user.id) };
  }

  private async recordFailure(userId: string, email: string, reason: string, countsTowardLockout: boolean) {
    let lockedUntil: Date | null = null;
    if (countsTowardLockout) {
      // Atomic increment, so parallel attempts can't each read the same count
      const { failedLoginCount } = await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      if (failedLoginCount >= LOCKOUT_THRESHOLD) {
        lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await this.prisma.user.update({ where: { id: userId }, data: { lockedUntil, failedLoginCount: 0 } });
        this.logger.warn({ userId }, 'Account locked after repeated failed sign-ins');
      }
    }
    await this.audit.record({
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: userId,
      actorUserId: null,
      after: { email, reason, ...(lockedUntil ? { lockedUntil } : {}) },
    });
  }

  async logout(auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
    await this.audit.record({ action: 'auth.logout', entityType: 'user', entityId: auth.user.id });
  }

  async logoutOtherSessions(auth: AuthContext): Promise<number> {
    const count = await this.sessions.revokeAllForUser(auth.user.id, { except: auth.sessionId });
    await this.audit.record({
      action: 'auth.sessions_revoked',
      entityType: 'user',
      entityId: auth.user.id,
      after: { sessionsRevoked: count },
    });
    return count;
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        employeeId: true,
        role: { select: { id: true, key: true, name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: displayName(user),
      role: { key: user.role.key, name: user.role.name },
      employeeId: user.employeeId,
      permissions: await this.permissions.forRole(user.role.id),
    };
  }

  /**
   * Sends a reset link when the email belongs to an active account, and does nothing otherwise. The
   * controller answers the same way in both cases and doesn't wait for this to finish.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
    if (!user || user.status !== 'ACTIVE') return;

    const token = generateToken();
    await this.prisma.$transaction(async (tx) => {
      // Only the newest link works
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      await this.audit.record({ action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id, actorUserId: null }, tx);
    });

    const link = `${this.config.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Reset your SeloraX People password',
      text: [
        'Someone asked to reset the password for this account.',
        '',
        `To choose a new password, open this link within 30 minutes:`,
        link,
        '',
        "If it wasn't you, ignore this email. Your password stays the same.",
      ].join('\n'),
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const invalid = () =>
      new UnprocessableEntityException({
        message: 'This reset link is invalid or has expired. Request a new one.',
        error: 'Unprocessable Entity',
      });

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      select: { id: true, expiresAt: true, usedAt: true, user: { select: { id: true, email: true, status: true } } },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.status !== 'ACTIVE') throw invalid();

    this.passwords.assertAcceptable(input.password, record.user.email);
    const passwordHash = await this.passwords.hash(input.password);

    await this.prisma.$transaction(async (tx) => {
      // Conditional update: two requests racing with the same link can't both succeed
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw invalid();

      await tx.user.update({
        where: { id: record.user.id },
        data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      });
      const revoked = await this.sessions.revokeAllForUser(record.user.id, {}, tx);
      await this.audit.record(
        { action: 'auth.password_reset', entityType: 'user', entityId: record.user.id, actorUserId: record.user.id, after: { sessionsRevoked: revoked } },
        tx,
      );
    });
  }

  async changePassword(auth: AuthContext, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { email: true, passwordHash: true } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        errors: { currentPassword: 'Your current password is incorrect' },
      });
    }
    this.passwords.assertAcceptable(input.newPassword, user.email, 'newPassword');
    const passwordHash = await this.passwords.hash(input.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: auth.user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
      const revoked = await this.sessions.revokeAllForUser(auth.user.id, { except: auth.sessionId }, tx);
      await this.audit.record({ action: 'auth.password_changed', entityType: 'user', entityId: auth.user.id, after: { sessionsRevoked: revoked } }, tx);
    });
  }
}
