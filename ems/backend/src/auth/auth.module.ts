import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PermissionsService } from './permissions.service';
import { ScopeService } from './scope.service';
import { SessionsService } from './sessions.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, PermissionsService, ScopeService, SessionsService],
  exports: [PasswordService, PermissionsService, ScopeService, SessionsService],
})
export class AuthModule {}
