import { z } from 'zod';
import type { PermissionMap } from './permissions';

export const SESSION_COOKIE = 'ems_session';
/** Readable by the page: the double-submit CSRF token, echoed in CSRF_HEADER on every write. */
export const CSRF_COOKIE = 'ems_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .max(254, 'That email address is too long')
  .pipe(z.email('Enter a valid email address'));

/** A password being set. The server also rejects common passwords (not checkable in the browser). */
export const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const loginInput = z.object({
  email,
  // Existing passwords are checked, not validated: any length rule here would leak the policy
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH, 'Email or password is incorrect'),
});
export type LoginInput = z.infer<typeof loginInput>;

export const forgotPasswordInput = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;

export const resetPasswordInput = z.object({
  token: z.string().min(20, 'This reset link is not valid').max(200, 'This reset link is not valid'),
  password: newPassword,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>;

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(PASSWORD_MAX_LENGTH),
    newPassword,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

/** `GET /auth/me`: who is signed in and what they may do. */
export interface MeResponse {
  id: string;
  email: string;
  name: string;
  role: { key: string; name: string };
  employeeId: string | null;
  permissions: PermissionMap;
}

export const FORGOT_PASSWORD_MESSAGE =
  'If an account uses that email, we have sent a link to reset the password. It expires in 30 minutes.';
