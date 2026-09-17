import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export const MAILER = Symbol('MAILER');

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Delivery channel for email (plan D7). Only the transport differs between environments. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Development only: prints the message instead of sending it. The env schema refuses this driver in
 * production, because password reset links would appear in logs.
 */
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('ConsoleMailer');

  send(message: MailMessage): Promise<void> {
    this.logger.log(`\n── Email to ${message.to} ──\nSubject: ${message.subject}\n\n${message.text}\n──`);
    return Promise.resolve();
  }
}

export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = createTransport(smtpUrl);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

/** Tests: keeps messages in memory so they can be inspected. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}
