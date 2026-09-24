import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can } from '@ems/contracts';
import type { Request } from 'express';
import { type PermissionRequirement, REQUIRED_PERMISSION } from '../decorators';

/** Answers 403 when the handler's @RequirePermission() isn't granted at the required scope. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const auth = context.switchToHttp().getRequest<Request>().auth;
    if (!auth || !can(auth.permissions, requirement.key, requirement.atLeast)) throw new ForbiddenException();
    return true;
  }
}
