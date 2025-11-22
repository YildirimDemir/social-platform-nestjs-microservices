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
  const httpPort = configService.get<number>('NOTIFICATIONS_HTTP_PORT', 4012);
  const httpHost = configService.get<string>('NOTIFICATIONS_HTTP_HOST', '0.0.0.0');

  app.connectMicroservice({
    transport: Transport.TCP,
    options: { host, port },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort, httpHost);
}

bootstrap();
