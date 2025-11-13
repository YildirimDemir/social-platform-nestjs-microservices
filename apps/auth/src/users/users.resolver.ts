import {
  Args,
  Query,
  Resolver,
  ObjectType,
  Field,
  Int,
  Mutation,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { User, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  UsersService,
  PaginatedUsersResult,
  PublicUser,
  ToggleFollowResult,
  MutationMessage,
} from './users.service';
import { GetAllUsersDto } from './dto/get-all-users.dto';
import { GetOneUserDto } from './dto/get-one-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfilePhotoDto } from './dto/update-profile-photo.dto';
import { UpdateUsernameDto } from './dto/update-username.dto';

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

@ObjectType()
class ToggleFollowModel implements ToggleFollowResult {
  @Field(() => Boolean)
  isFollowing: boolean;

  @Field(() => Int)
  followerCount: number;

  @Field(() => Int)
  followingCount: number;
}

@ObjectType()
class MutationMessageModel implements MutationMessage {
  @Field()
  message: string;
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

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ToggleFollowModel)
  async toggleFollow(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser: PublicUser,
  ): Promise<ToggleFollowResult> {
    return this.usersService.toggleFollow(currentUser.id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => User)
  async updateUsername(
    @Args('input', { type: () => UpdateUsernameDto }) input: UpdateUsernameDto,
    @CurrentUser() currentUser: PublicUser,
  ): Promise<PublicUser> {
    return this.usersService.updateUsername(currentUser.id, input.newUsername);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => MutationMessageModel)
  async updatePassword(
    @Args('input', { type: () => UpdatePasswordDto }) input: UpdatePasswordDto,
    @CurrentUser() currentUser: PublicUser,
  ): Promise<MutationMessage> {
    return this.usersService.updatePassword(
      currentUser.id,
      input.currentPassword,
      input.newPassword,
      input.confirmPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => User)
  async updateProfilePhoto(
    @Args('input', { type: () => UpdateProfilePhotoDto })
    input: UpdateProfilePhotoDto,
    @CurrentUser() currentUser: PublicUser,
  ): Promise<PublicUser> {
    return this.usersService.updateProfilePhoto(currentUser.id, input.photoUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => User)
  async removeProfilePhoto(
    @CurrentUser() currentUser: PublicUser,
  ): Promise<PublicUser> {
    return this.usersService.removeProfilePhoto(currentUser.id);
  }
}
