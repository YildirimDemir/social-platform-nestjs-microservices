import { Args, Query, Resolver, ObjectType, Field, Int } from '@nestjs/graphql';
import { User } from '@app/common';
import { UsersService, PaginatedUsersResult } from './users.service';
import { GetAllUsersDto } from './dto/get-all-users.dto';
import { GetOneUserDto } from './dto/get-one-user.dto';

@ObjectType()
class PaginatedUsersModel {
  @Field(() => [User])
  items: User[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => PaginatedUsersModel, { name: 'users' })
  async getUsers(
    @Args('input', { type: () => GetAllUsersDto, nullable: true })
    input?: GetAllUsersDto,
  ): Promise<PaginatedUsersResult> {
    const filters = input ?? new GetAllUsersDto();
    return this.usersService.getUsers(filters);
  }

  @Query(() => User, { name: 'user' })
  async getUser(
    @Args('input', { type: () => GetOneUserDto }) input: GetOneUserDto,
  ) {
    return this.usersService.getUser(input);
  }
}
