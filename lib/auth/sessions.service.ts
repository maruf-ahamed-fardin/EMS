import { Injectable } from '@nestjs/common';
import { generateToken, hashToken } from '@/lib/http/security/tokens';
import type { Prisma } from '@/lib/db/generated/prisma/client';
import { PrismaService } from '@/lib/db/prisma';
import type { AuthContext } from './auth-context';
import { PermissionsService } from './permissions.service';
import { SESSION_ABSOLUTE_MS, sessionState, shouldTouch } from './session-policy';

type Db = PrismaService | Prisma.TransactionClient;

export function displayName(user: { email: string; employee: { firstName: string; lastName: string } | null }) {
  return user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : (user.email.split('@')[0] ?? user.email);
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Starts a session and returns the token for the cookie. Only its hash is stored. */
  async create(userId: string, meta: { ip?: string; userAgent?: string }, db: Db = this.prisma): Promise<string> {
    const token = generateToken();
    await db.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
      },
    });
    return token;
  }

  /**
   * The context for a cookie token, or null when the session is unknown, revoked, expired, idle, or
   * belongs to a user who is no longer active.
   */
  async authenticate(token: string, now = new Date()): Promise<AuthContext | null> {
    if (!token || token.length > 200) return null;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        lastSeenAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            lockedUntil: true,
            employeeId: true,
            role: { select: { id: true, key: true, name: true } },
            employee: { select: { firstName: true, lastName: true, status: true, deletedAt: true } },
          },
        },
      },
    });
    if (!session || sessionState(session, now) !== 'active') return null;

    const { user } = session;
    const employeeGone = user.employee && (user.employee.status !== 'ACTIVE' || user.employee.deletedAt);
    if (user.status !== 'ACTIVE' || employeeGone) return null;

    if (shouldTouch(session.lastSeenAt, now)) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    return {
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        name: displayName(user),
        employeeId: user.employeeId,
        role: user.role,
      },
      permissions: await this.permissions.forRole(user.role.id),
    };
  }

  async revoke(sessionId: string, db: Db = this.prisma): Promise<void> {
    await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Signs a user out everywhere, optionally keeping the session making the request. */
  async revokeAllForUser(userId: string, options: { except?: string } = {}, db: Db = this.prisma): Promise<number> {
    const { count } = await db.session.updateMany({
      where: { userId, revokedAt: null, ...(options.except ? { id: { not: options.except } } : {}) },
      data: { revokedAt: new Date() },
    });
    return count;
  }
}
