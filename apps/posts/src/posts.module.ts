import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { PostsService } from './posts.service';
import {
  AUTH_SERVICE,
  NOTIFICATIONS_SERVICE,
  DatabaseModule,
  JwtAuthGuard,
  PostsRepository,
  UsersRepository,
  Post,
  User,
  Role,
} from '@app/common';
import { LoggerModule } from 'nestjs-pino';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { join } from 'path';
import { PostsResolver } from './posts.resolver';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/posts/.env',
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
      }),
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'apps/posts/src/schema.gql'),
        federation: 2,
      },
      sortSchema: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([Post, User, Role]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true },
        },
      },
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
      {
        name: NOTIFICATIONS_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>('NOTIFICATIONS_HOST', 'notifications'),
            port: configService.get<number>('NOTIFICATIONS_PORT', 4010),
          },
        }),
      },
    ]),
  ],
  providers: [PostsService, PostsResolver, JwtAuthGuard, PostsRepository, UsersRepository],
})
export class PostsModule {}
