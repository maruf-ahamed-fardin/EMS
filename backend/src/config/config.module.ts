import { Global, Inject, Module } from '@nestjs/common';
import { parseEnv, type AppConfig } from './env';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Injects the validated configuration: `constructor(@InjectConfig() config: AppConfig)`. */
export const InjectConfig = () => Inject(APP_CONFIG);

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => parseEnv() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}

export type { AppConfig };
