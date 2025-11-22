import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailModule } from './mail/mail.module';
import { DatabaseModule } from '@app/common';
import { Notification } from './notification.entity';
import { NotificationRepository } from './notification.repository';
import { NotificationsResolver } from './notifications.resolver';
import { JwtAuthGuard, AUTH_SERVICE } from '@app/common';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/notifications/.env',
    }),
    DatabaseModule,
    DatabaseModule.forFeature([Notification]),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'apps/notifications/src/schema.gql'),
        federation: 2,
      },
      sortSchema: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>('AUTH_TCP_HOST', 'auth'),
            port: configService.get<number>('AUTH_TCP_PORT', 4011),
          },
        }),
      },
    ]),
    MailModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationRepository,
    NotificationsResolver,
    JwtAuthGuard,
  ],
})
export class NotificationsModule {}
