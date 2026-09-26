import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { ConsoleMailer, MAILER, type Mailer, SmtpMailer } from './mailer';

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Mailer =>
        config.MAIL_DRIVER === 'smtp' && config.SMTP_URL
          ? new SmtpMailer(config.SMTP_URL, config.MAIL_FROM)
          : new ConsoleMailer(),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
