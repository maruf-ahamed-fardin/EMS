import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CSRF_COOKIE, type DataResponse, FORGOT_PASSWORD_MESSAGE, type MeResponse } from '@ems/contracts';
import type { Request, Response } from 'express';
import { InjectConfig, type AppConfig } from '../config/config.module';
import type { AuthContext } from './auth-context';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './auth.dto';
import { AuthService } from './auth.service';
import { clearAuthCookies, setCsrfCookie, setSessionCookie } from './cookies';
import { CurrentAuth, Public } from './decorators';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** Issues the CSRF cookie when the browser doesn't have one yet. Call before the first write. */
  @Public()
  @SkipThrottle()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response): DataResponse<{ csrfToken: string }> {
    const existing = (req.cookies as Record<string, string | undefined>)[CSRF_COOKIE];
    const csrfToken = existing && existing.length >= 32 ? existing : setCsrfCookie(res, this.config);
    return { data: { csrfToken } };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DataResponse<MeResponse>> {
    const { token, me } = await this.auth.login(body, { ip: req.ip, userAgent: req.get('user-agent') });
    setSessionCookie(res, this.config, token);
    // A new CSRF token for the new session
    setCsrfCookie(res, this.config);
    return { data: me };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(auth);
    clearAuthCookies(res, this.config);
  }

  @Post('logout-others')
  @HttpCode(HttpStatus.OK)
  async logoutOthers(@CurrentAuth() auth: AuthContext): Promise<DataResponse<{ sessionsRevoked: number }>> {
    return { data: { sessionsRevoked: await this.auth.logoutOtherSessions(auth) } };
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext): Promise<DataResponse<MeResponse>> {
    return { data: await this.auth.me(auth.user.id) };
  }

  /**
   * Always 202 with the same body, and the work happens after the response, so neither the answer nor
   * its timing shows whether an account exists.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: HOUR } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  forgotPassword(@Body() body: ForgotPasswordDto): DataResponse<{ message: string }> {
    this.auth.requestPasswordReset(body.email).catch((error: unknown) => {
      this.logger.error({ err: error }, 'Password reset request failed');
    });
    return { data: { message: FORGOT_PASSWORD_MESSAGE } };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(body);
  }

  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentAuth() auth: AuthContext, @Body() body: ChangePasswordDto): Promise<void> {
    await this.auth.changePassword(auth, body);
  }
}
