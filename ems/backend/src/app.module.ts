import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { PermissionGuard } from './auth/guards/permission.guard';
import { SessionGuard } from './auth/guards/session.guard';
import { AppThrottlerGuard } from './auth/guards/throttler.guard';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { loggerOptions } from './common/logging/logger.options';
import { APP_CONFIG, ConfigModule, type AppConfig } from './config/config.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [APP_CONFIG], useFactory: (config: AppConfig) => loggerOptions(config) }),
    // In-memory counters: correct for one instance. Use the Redis storage when running several (plan §12).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    HealthModule,
    RolesModule,
    EmployeesModule,
  ],
  providers: [
    // Every DTO made with createZodDto is validated before the handler runs
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // Guards run in this order: reject forged writes, identify the user, count the request, check permission
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
