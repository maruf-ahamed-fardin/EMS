import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuditCoverageInterceptor } from '@/lib/services/audit/audit-coverage';
import { AuditModule } from '@/lib/services/audit/audit.module';
import { AuthModule } from '@/lib/auth/auth.module';
import { CsrfGuard } from '@/lib/auth/guards/csrf.guard';
import { PermissionGuard } from '@/lib/auth/guards/permission.guard';
import { SessionGuard } from '@/lib/auth/guards/session.guard';
import { accountTracker, AppThrottlerGuard, skipAccountThrottle } from '@/lib/auth/guards/throttler.guard';
import { ApiExceptionFilter } from '@/lib/http/errors/api-exception.filter';
import { loggerOptions } from '@/lib/http/logging/logger.options';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceModule } from '@/lib/services/attendance/attendance.controller';
import { CalendarModule } from '@/lib/services/calendar/calendar.service';
import { ClockModule } from '@/lib/http/clock';
import { LeaveModule } from '@/lib/services/leave/leave.controller';
import { SettingsModule } from '@/lib/services/settings/settings.controller';
import { APP_CONFIG, ConfigModule, type AppConfig } from '@/config/config.module';
import { DashboardCacheModule } from '@/lib/services/dashboard/dashboard-cache';
import { DashboardModule } from '@/lib/services/dashboard/dashboard.controller';
import { DocumentsModule } from '@/lib/services/documents/documents.controller';
import { EmployeesModule } from '@/lib/services/employees/employees.module';
import { HealthModule } from '@/lib/services/health/health.module';
import { MailModule } from '@/lib/services/mail/mail.module';
import { NotificationsModule } from '@/lib/services/notifications/notifications.controller';
import { OrganizationModule } from '@/lib/services/organization/organization.module';
import { TeamProfileModule } from '@/lib/services/team-profile/team-profile.module';
import { PrismaModule } from '@/lib/db/prisma.module';
import { ReportsModule } from '@/lib/services/reports/reports.controller';
import { RolesModule } from '@/lib/services/roles/roles.module';
import { UsersModule } from '@/lib/services/users/users.controller';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [APP_CONFIG], useFactory: (config: AppConfig) => loggerOptions(config) }),
    // In-memory counters: correct for one instance. Use the Redis storage when running several (plan §12).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 300 },
      // Inert except on routes marked @ThrottlePerAccount, which set their own limits
      { name: 'account', ttl: 60_000, limit: 300, getTracker: (req) => accountTracker(req as Request), skipIf: skipAccountThrottle },
    ]),
    ScheduleModule.forRoot(),
    ClockModule,
    PrismaModule,
    AuditModule,
    NotificationsModule,
    MailModule,
    AuthModule,
    CalendarModule,
    DashboardCacheModule,
    HealthModule,
    RolesModule,
    UsersModule,
    EmployeesModule,
    OrganizationModule,
    TeamProfileModule,
    DashboardModule,
    AttendanceModule,
    SettingsModule,
    LeaveModule,
    DocumentsModule,
    ReportsModule,
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
    // Every successful write is audited, or says why not (plan §8)
    { provide: APP_INTERCEPTOR, useClass: AuditCoverageInterceptor },
  ],
})
export class AppModule {}
