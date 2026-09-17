import { changePasswordInput, forgotPasswordInput, loginInput, resetPasswordInput } from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginInput) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordInput) {}
export class ResetPasswordDto extends createZodDto(resetPasswordInput) {}
export class ChangePasswordDto extends createZodDto(changePasswordInput) {}
