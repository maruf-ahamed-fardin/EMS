import { createParamDecorator, type ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { PermissionKey, PermissionScope } from '@/lib/validations';
import type { Request } from 'express';
import type { AuthContext } from './auth-context';

export const IS_PUBLIC = 'auth:public';
export const REQUIRED_PERMISSION = 'auth:permission';

/** Reachable without signing in. Every other route requires a valid session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface PermissionRequirement {
  key: PermissionKey;
  atLeast: PermissionScope;
}

/**
 * The permission a handler needs. The guard answers 403 without it; the handler still narrows data to
 * the granted scope through ScopeService.
 */
export const RequirePermission = (key: PermissionKey, atLeast: PermissionScope = 'OWN') =>
  SetMetadata(REQUIRED_PERMISSION, { key, atLeast } satisfies PermissionRequirement);

/** The signed-in user's context. Only on routes that aren't @Public(). */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const auth = ctx.switchToHttp().getRequest<Request>().auth;
  if (!auth) throw new UnauthorizedException();
  return auth;
});
