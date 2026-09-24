import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationService } from './invitations.service';
import { PasswordService } from './password.service';
import { PermissionsService } from './permissions.service';
import { ScopeService } from './scope.service';
import { SessionsService } from './sessions.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, InvitationService, PasswordService, PermissionsService, ScopeService, SessionsService],
  exports: [InvitationService, PasswordService, PermissionsService, ScopeService, SessionsService],
})
export class AuthModule {}
