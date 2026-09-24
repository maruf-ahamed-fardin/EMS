import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { checkPassword, PASSWORD_PROBLEM_MESSAGES } from './password-policy';

/** OWASP's argon2id baseline: 19 MiB memory, 2 iterations, 1 lane. */
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  /** Verified when an email has no account, so that path takes as long as a wrong password. */
  private readonly dummyHash = argon2.hash('no account uses this password', HASH_OPTIONS);

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash ?? (await this.dummyHash), password);
    } catch {
      // A malformed stored hash counts as a mismatch, never as a server error that reveals the account
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, HASH_OPTIONS);
  }

  /** Throws 422 in the API error shape when a new password breaks the policy. */
  assertAcceptable(password: string, email: string, field = 'password'): void {
    const problem = checkPassword(password, email);
    if (problem) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        errors: { [field]: PASSWORD_PROBLEM_MESSAGES[problem] },
      });
    }
  }
}
