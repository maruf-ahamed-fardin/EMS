import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { loggerOptions } from './common/logging/logger.options';
import { APP_CONFIG, ConfigModule, type AppConfig } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [APP_CONFIG], useFactory: (config: AppConfig) => loggerOptions(config) }),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    // Every DTO made with createZodDto is validated before the handler runs
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
