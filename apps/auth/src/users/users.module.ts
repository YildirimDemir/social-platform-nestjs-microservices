import { Module } from '@nestjs/common';
import { DatabaseModule, Role, User, Post, UsersRepository } from '@app/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule.forFeature([User, Role, Post])],
  providers: [UsersResolver, UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
