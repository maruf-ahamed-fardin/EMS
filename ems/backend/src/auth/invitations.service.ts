import { Inject, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { generateToken, hashToken } from '../common/security/tokens';
import { InjectConfig, type AppConfig } from '../config/config.module';
import type { Prisma } from '../generated/prisma/client';
import { MAILER, type Mailer } from '../mail/mailer';
import { INVITE_TOKEN_TTL_MS } from './session-policy';

/**
 * "Choose your password" links for accounts made by someone else: a new account, or one an
 * administrator resends. The link is the same single-use reset token the forgot-password flow uses,
 * valid for 3 days because the person may not be expecting it.
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** A random password nobody knows, for an account whose owner will choose theirs from the link. */
  unusablePasswordHash(): Promise<string> {
    return argon2.hash(generateToken(), { type: argon2.argon2id });
  }

  /** A new link for the account; any earlier unused links stop working. Returns the token to send. */
  async issue(tx: Prisma.TransactionClient, userId: string): Promise<string> {
    const token = generateToken();
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS) } });
    return token;
  }

  /** Sends the link without making the caller wait; a failed email is logged, and the link can be resent. */
  send(email: string, firstName: string, token: string, kind: 'new' | 'resend'): void {
    const link = `${this.config.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    this.mailer
      .send({
        to: email,
        subject: kind === 'new' ? 'Your SeloraX People account' : 'Choose a new password for SeloraX People',
        text: [
          `Hi ${firstName},`,
          '',
          kind === 'new' ? 'An account has been created for you in SeloraX People.' : 'An administrator sent you a link to choose a new password.',
          'Choose your password with this link within 3 days:',
          link,
          '',
          'If the link has expired, use "Forgot password?" on the sign-in page.',
        ].join('\n'),
      })
      .catch((error: unknown) => this.logger.error({ err: error }, 'Could not send the password link'));
  }
}
