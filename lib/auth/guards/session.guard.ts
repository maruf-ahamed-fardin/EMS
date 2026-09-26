import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE } from '@/lib/validations';
import type { Request, Response } from 'express';
import { currentRequest } from '@/lib/http/request-context';
import { InjectConfig, type AppConfig } from '@/config/config.module';
import { clearAuthCookies } from '../cookies';
import { IS_PUBLIC } from '../decorators';
import { SessionsService } from '../sessions.service';

/** Every route needs a valid session unless it is marked @Public(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const token = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE];

    const auth = token ? await this.sessions.authenticate(token) : null;
    if (!auth) {
      if (token) clearAuthCookies(http.getResponse<Response>(), this.config);
      throw new UnauthorizedException();
    }

    req.auth = auth;
    const requestContext = currentRequest();
    if (requestContext) requestContext.userId = auth.user.id;
    return true;
  }
}
