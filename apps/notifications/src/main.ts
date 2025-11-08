import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { NotificationsModule } from './notifications.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  const host = configService.get<string>('NOTIFICATIONS_HOST', '0.0.0.0');
  const port = configService.get<number>('NOTIFICATIONS_PORT', 4010);

  app.connectMicroservice({
    transport: Transport.TCP,
    options: { host, port },
  });

  await app.startAllMicroservices();
}

bootstrap();
