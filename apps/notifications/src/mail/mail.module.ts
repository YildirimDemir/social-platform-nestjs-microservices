import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MAIL_FROM, MAIL_TRANSPORTER } from './mail.constants';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Transporter => {
        return createTransport({
          host: configService.get<string>('EMAIL_HOST'),
          port: Number(configService.get<string>('EMAIL_PORT', '465')),
          secure: configService.get<string>('EMAIL_SECURE', 'true') === 'true',
          auth: {
            user: configService.get<string>('EMAIL_USERNAME'),
            pass: configService.get<string>('EMAIL_PASSWORD'),
          },
        });
      },
    },
    {
      provide: MAIL_FROM,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get<string>('EMAIL_FROM', 'no-reply@example.com'),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
