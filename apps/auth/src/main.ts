import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as cookieParser from 'cookie-parser';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const tcpPort = configService.get<number>('AUTH_TCP_PORT');
  if (tcpPort) {
    const tcpHost = configService.get<string>('AUTH_TCP_HOST', '0.0.0.0');
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: {
        host: tcpHost,
        port: tcpPort,
      },
    });
  }

  await app.startAllMicroservices();

  const httpPort = configService.get<number>('AUTH_HTTP_PORT', 3001);
  const httpHost = configService.get<string>('AUTH_HTTP_HOST', '0.0.0.0');
  await app.listen(httpPort, httpHost);
}

bootstrap();
