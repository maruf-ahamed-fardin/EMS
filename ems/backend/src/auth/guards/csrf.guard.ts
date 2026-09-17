import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CSRF_COOKIE, CSRF_HEADER } from '@ems/contracts';
import type { Request } from 'express';
import { InjectConfig, type AppConfig } from '../../config/config.module';
import { safeEqual } from '../../common/security/tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type CsrfVerdict = 'ok' | 'cross_site' | 'bad_origin' | 'missing_token' | 'token_mismatch';

export interface CsrfRequest {
  method: string;
  origin: string | undefined;
  fetchSite: string | undefined;
  cookieToken: string | undefined;
  headerToken: string | undefined;
}

/**
 * Plan §5 layers three checks on every write, on top of the SameSite=Lax cookie:
 * the browser's Sec-Fetch-Site, the Origin header, and a double-submit token.
 */
export function checkCsrf(req: CsrfRequest, allowedOrigins: ReadonlySet<string>): CsrfVerdict {
  if (SAFE_METHODS.has(req.method)) return 'ok';
  if (req.fetchSite && req.fetchSite !== 'same-origin' && req.fetchSite !== 'none') return 'cross_site';
  if (req.origin && !allowedOrigins.has(req.origin)) return 'bad_origin';
  if (!req.cookieToken || !req.headerToken) return 'missing_token';
  return safeEqual(req.cookieToken, req.headerToken) ? 'ok' : 'token_mismatch';
}

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(@InjectConfig() config: AppConfig) {
    this.allowedOrigins = new Set([config.APP_URL, ...config.CORS_ORIGINS]);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const verdict = checkCsrf(
      {
        method: req.method,
        origin: req.get('origin'),
        fetchSite: req.get('sec-fetch-site'),
        cookieToken: (req.cookies as Record<string, string | undefined>)[CSRF_COOKIE],
        headerToken: req.get(CSRF_HEADER),
      },
      this.allowedOrigins,
    );
    if (verdict !== 'ok') throw new ForbiddenException('Your session needs refreshing. Reload the page and try again.');
    return true;
  }
}
