import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@ems/contracts';

/**
 * Commonly breached passwords that are long enough to pass the length rule. Shorter ones are already
 * rejected by length, so they don't need to be here.
 */
const COMMON_PASSWORDS = new Set([
  '1234567890', '12345678910', '123456789a', '123456789q', '0123456789', '0987654321', '1111111111',
  '1q2w3e4r5t', '1q2w3e4r5t6y', '1qaz2wsx3edc', 'qwertyuiop', 'qwerty1234', 'qwerty12345', 'qwerty123456',
  'asdfghjkl1', 'zxcvbnm123', 'abcdefghij', 'abcd123456', 'abc1234567', 'password12', 'password123',
  'password1234', 'password1!', 'passw0rd123', 'p@ssword123', 'p@ssw0rd123', 'iloveyou12', 'iloveyou123',
  'letmein1234', 'welcome123', 'welcome1234', 'admin12345', 'administrator', 'changeme123', 'football123',
  'baseball123', 'sunshine123', 'princess123', 'dragon1234', 'monkey12345', 'superman123', 'trustno1234',
  'bangladesh', 'bangladesh1', 'bangladesh123', 'dhaka12345', 'selorax123', 'selorax1234', 'selorax2026',
]);

export type PasswordProblem = 'too_short' | 'too_long' | 'common' | 'contains_email' | 'repetitive';

export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  too_short: `Use at least ${PASSWORD_MIN_LENGTH} characters`,
  too_long: `Use at most ${PASSWORD_MAX_LENGTH} characters`,
  common: 'This password is too common. Choose something harder to guess.',
  contains_email: "Don't use your email address in your password",
  repetitive: 'Avoid repeating the same character',
};

/** Returns the first problem with a new password, or null when it is acceptable. */
export function checkPassword(password: string, email?: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (password.length > PASSWORD_MAX_LENGTH) return 'too_long';

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'common';
  if (new Set(lower).size <= 2) return 'repetitive';

  const localPart = email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) return 'contains_email';

  return null;
}
