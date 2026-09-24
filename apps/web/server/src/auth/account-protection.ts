import { ForbiddenException } from '@nestjs/common';
import { conflict } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import type { AuthContext } from './auth-context';

export const SUPER_ADMIN = 'super_admin';

/** Super Admin accounts that can actually sign in: active, with an active employee record or none. */
export const USABLE_SUPER_ADMIN: Prisma.UserWhereInput = {
  status: 'ACTIVE',
  role: { key: SUPER_ADMIN },
  OR: [{ employeeId: null }, { employee: { status: 'ACTIVE', deletedAt: null } }],
};

/**
 * Refuses a change that would leave nobody able to sign in as Super Admin. Call it inside the
 * transaction that makes the change: the advisory lock makes every such change wait for the one
 * before it to commit, so two admins removing each other at once can't both succeed.
 */
export async function assertSuperAdminRemains(tx: Prisma.TransactionClient, losingUserId: string, message: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('users.super_admin'))`;
  const others = await tx.user.count({ where: { ...USABLE_SUPER_ADMIN, id: { not: losingUserId } } });
  if (others === 0) throw conflict(message);
}

/** Only a Super Admin may change a Super Admin's account, or make someone Super Admin. */
export function mayChangeAccount(auth: AuthContext, roleKey: string): boolean {
  return roleKey !== SUPER_ADMIN || auth.user.role.key === SUPER_ADMIN;
}

export function assertMayChangeAccount(auth: AuthContext, roleKey: string): void {
  if (!mayChangeAccount(auth, roleKey)) throw new ForbiddenException("Only a Super Admin can change a Super Admin's account");
}

/** Password links sent earlier stop working: the account was deactivated or its email changed. */
export function revokePasswordLinks(tx: Prisma.TransactionClient, userId: string): Promise<Prisma.BatchPayload> {
  return tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
}
