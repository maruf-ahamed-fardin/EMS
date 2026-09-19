import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuditCoverageInterceptor } from './audit/audit-coverage';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { PermissionGuard } from './auth/guards/permission.guard';
import { SessionGuard } from './auth/guards/session.guard';
import { AppThrottlerGuard } from './auth/guards/throttler.guard';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { loggerOptions } from './common/logging/logger.options';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceModule } from './attendance/attendance.controller';
import { CalendarModule } from './calendar/calendar.service';
import { ClockModule } from './common/clock';
import { LeaveModule } from './leave/leave.controller';
import { SettingsModule } from './settings/settings.controller';
import { APP_CONFIG, ConfigModule, type AppConfig } from './config/config.module';
import { DashboardCacheModule } from './dashboard/dashboard-cache';
import { DashboardModule } from './dashboard/dashboard.controller';
import { DocumentsModule } from './documents/documents.controller';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.controller';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.controller';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [APP_CONFIG], useFactory: (config: AppConfig) => loggerOptions(config) }),
    // In-memory counters: correct for one instance. Use the Redis storage when running several (plan §12).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
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
    EmployeesModule,
    OrganizationModule,
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
