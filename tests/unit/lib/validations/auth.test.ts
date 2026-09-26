import { describe, expect, it } from 'vitest';
import { changePasswordInput, loginInput, resetPasswordInput } from '@/lib/validations/auth';

describe('auth inputs', () => {
  it('normalizes the email before validating it', () => {
    expect(loginInput.parse({ email: '  Rahim@Demo.SeloraX.test ', password: 'x' }).email).toBe('rahim@demo.selorax.test');
  });

  it('rejects a malformed email with a readable message', () => {
    const result = loginInput.safeParse({ email: 'rahim@', password: 'x' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Enter a valid email address');
  });

  it('enforces the minimum length only when setting a password', () => {
    expect(loginInput.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
    expect(resetPasswordInput.safeParse({ token: 'x'.repeat(43), password: 'short' }).success).toBe(false);
  });

  it('refuses a new password equal to the current one', () => {
    const result = changePasswordInput.safeParse({ currentPassword: 'same-password-1', newPassword: 'same-password-1' });
    expect(result.error?.issues[0]?.path).toEqual(['newPassword']);
  });
});
