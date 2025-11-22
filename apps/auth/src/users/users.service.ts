import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { User, Role, UsersRepository } from '@app/common';
import { GetOneUserDto } from './dto/get-one-user.dto';
import { GetAllUsersDto } from './dto/get-all-users.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { hashValue } from '../utils/hash.util';

const DEFAULT_PROFILE_PHOTO =
  process.env.DEFAULT_PROFILE_PHOTO_URL ||
  'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';

interface CreateUserOptions {
  username: string;
  email: string;
  password: string;
  roles: Role[];
}

export type PublicUser = Omit<User, 'password'> & {
  followersCount?: number;
  followingCount?: number;
};

export interface PaginatedUsersResult {
  items: PublicUser[];
  total: number;
  page: number;
  limit: number;
}

export interface ToggleFollowResult {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export interface MutationMessage {
  message: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectRepository(User)
    private readonly userEntityRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly configService: ConfigService,
  ) {}

  async findById(id: number) {
    if (!id) return null;
    return this.userEntityRepository.findOne({
      where: { id },
      relations: { roles: true },
    });
  }

  async findByEmail(email: string) {
    if (!email) return null;
    return this.userEntityRepository.findOne({
      where: { email },
      relations: { roles: true },
    });
  }

  async findByUsername(username: string) {
    if (!username) return null;
    return this.userEntityRepository.findOne({
      where: { username },
      relations: { roles: true },
    });
  }

  async getUser(dto: GetOneUserDto): Promise<PublicUser> {
    const { id, email, username } = dto;

    const conditions = [] as Array<{ id?: number; email?: string; username?: string }>;

    if (id) {
      conditions.push({ id });
    }
    if (email) {
      conditions.push({ email: email.toLowerCase() });
    }
    if (username) {
      conditions.push({ username });
    }

    if (!conditions.length) {
      throw new BadRequestException('Provide id, email, or username to locate the user.');
    }

    const user = await this.userEntityRepository.findOne({
      where:
        conditions.length === 1
          ? conditions[0]
          : conditions.map((condition) => ({ ...condition })),
      relations: { roles: true, followers: true, following: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(user);
  }

  async getFollowers(userId: number): Promise<PublicUser[]> {
    if (!userId) {
      throw new BadRequestException('Invalid user id.');
    }

    const user = await this.userEntityRepository.findOne({
      where: { id: userId },
      relations: { followers: { roles: true } },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUsers(user.followers ?? []);
  }

  async getFollowing(userId: number): Promise<PublicUser[]> {
    if (!userId) {
      throw new BadRequestException('Invalid user id.');
    }

    const user = await this.userEntityRepository.findOne({
      where: { id: userId },
      relations: { following: { roles: true } },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUsers(user.following ?? []);
  }

  async getUsers(dto: GetAllUsersDto): Promise<PaginatedUsersResult> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const qb = this.buildUsersQuery();

    if (dto.search) {
      const search = dto.search.trim().toLowerCase();
      qb.andWhere(
        '(LOWER(user.username) LIKE :search OR LOWER(user.email) LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (dto.roles?.length) {
      const roles = dto.roles.map((name) => name.toLowerCase());
      qb.andWhere('LOWER(role.name) IN (:...roles)', { roles });
    }

    qb.take(limit).skip(offset).orderBy('user.id', 'DESC').distinct(true);

    const [users, total] = await qb.getManyAndCount();

    return {
      items: this.toPublicUsers(users),
      total,
      page,
      limit,
    };
  }

  async resolveRoles(roleNames?: (string | undefined)[]) {
    const names = (roleNames?.filter(Boolean) as string[]) ?? [];
    if (!names.length) {
      const defaultRole = await this.ensureRoleExists('user');
      return [defaultRole];
    }

    const normalized = Array.from(
      new Set(names.map((name) => name.toLowerCase())),
    );

    const existing = await this.roleRepository.find({
      where: { name: In(normalized) },
    });

    const foundNames = new Set(existing.map((role) => role.name));
    const toCreate = normalized.filter((name) => !foundNames.has(name));

    if (toCreate.length) {
      const createdRoles = await this.roleRepository.save(
        toCreate.map((name) => this.roleRepository.create({ name })),
      );
      existing.push(...createdRoles);
    }

    return existing;
  }

  async createUser({
    username,
    email,
    password,
    roles,
  }: CreateUserOptions): Promise<PublicUser> {
    const created = await this.userEntityRepository.save({
      username,
      email,
      password,
      profilePhoto: DEFAULT_PROFILE_PHOTO,
      bio: '',
      headerImage: '',
      roles,
    });

    return this.toPublicUser(created);
  }

  async deleteUserById(id: number) {
    if (!id) {
      throw new BadRequestException('Invalid user id.');
    }

    const result = await this.userEntityRepository.delete({ id });

    if (!result.affected) {
      throw new NotFoundException('User not found.');
    }
  }

  async verifyUser(email: string, password: string): Promise<PublicUser> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userEntityRepository.findOne({
      where: { email: normalizedEmail },
      relations: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.toPublicUser(user);
  }

  async toggleFollow(
    currentUserId: number,
    targetUserId: number,
  ): Promise<ToggleFollowResult> {
    if (!currentUserId || !targetUserId) {
      throw new BadRequestException('Invalid user ids.');
    }

    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself.');
    }

    const [currentUser, targetUser] = await Promise.all([
      this.userEntityRepository.findOne({
        where: { id: currentUserId },
        relations: { following: true },
      }),
      this.userEntityRepository.findOne({
        where: { id: targetUserId },
        relations: { followers: true },
      }),
    ]);

    if (!currentUser) {
      throw new NotFoundException('Current user not found.');
    }

    if (!targetUser) {
      throw new NotFoundException('Target user not found.');
    }

    const isAlreadyFollowing =
      currentUser.following?.some((user) => user.id === targetUserId) ?? false;

    const relation = this.userEntityRepository
      .createQueryBuilder()
      .relation(User, 'following')
      .of(currentUserId);

    if (isAlreadyFollowing) {
      await relation.remove(targetUserId);
    } else {
      await relation.add(targetUserId);
    }

    const [updatedCurrent, updatedTarget] = await Promise.all([
      this.userEntityRepository.findOne({
        where: { id: currentUserId },
        relations: { following: true },
      }),
      this.userEntityRepository.findOne({
        where: { id: targetUserId },
        relations: { followers: true },
      }),
    ]);

    return {
      isFollowing: !isAlreadyFollowing,
      followerCount: updatedTarget?.followers?.length ?? 0,
      followingCount: updatedCurrent?.following?.length ?? 0,
    };
  }

  async updateUsername(userId: number, newUsername: string): Promise<PublicUser> {
    const username = newUsername?.trim();

    if (!username) {
      throw new BadRequestException('Username cannot be empty.');
    }

    const existing = await this.userEntityRepository.findOne({
      where: { username },
    });

    if (existing && existing.id !== userId) {
      throw new BadRequestException('Username is already taken.');
    }

    await this.userEntityRepository.update(
      { id: userId },
      { username },
    );

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(updated);
  }

  async updatePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<MutationMessage> {
    const user = await this.userEntityRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Password values are required.');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('New passwords do not match.');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters.');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const hashed = await hashValue(newPassword, this.configService);

    await this.userEntityRepository.update(
      { id: userId },
      { password: hashed },
    );

    return { message: 'Password updated successfully.' };
  }

  async updateProfilePhoto(
    userId: number,
    photoUrl: string,
  ): Promise<PublicUser> {
    if (!userId) {
      throw new BadRequestException('Invalid user.');
    }

    const sanitizedUrl = photoUrl?.trim();

    if (!sanitizedUrl) {
      throw new BadRequestException('Photo URL is required.');
    }

    await this.userEntityRepository.update(
      { id: userId },
      { profilePhoto: sanitizedUrl },
    );

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(updated);
  }

  async removeProfilePhoto(userId: number): Promise<PublicUser> {
    if (!userId) {
      throw new BadRequestException('Invalid user.');
    }

    await this.userEntityRepository.update(
      { id: userId },
      { profilePhoto: DEFAULT_PROFILE_PHOTO },
    );

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(updated);
  }

  async updateBio(userId: number, bio?: string): Promise<PublicUser> {
    if (!userId) {
      throw new BadRequestException('Invalid user.');
    }

    const sanitized = bio?.trim() ?? '';

    await this.userEntityRepository.update(
      { id: userId },
      { bio: sanitized },
    );

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(updated);
  }

  async updateHeaderImage(
    userId: number,
    headerImage?: string,
  ): Promise<PublicUser> {
    if (!userId) {
      throw new BadRequestException('Invalid user.');
    }

    const sanitized = headerImage?.trim();

    if (!sanitized) {
      throw new BadRequestException('Header image URL is required.');
    }

    await this.userEntityRepository.update(
      { id: userId },
      { headerImage: sanitized },
    );

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(updated);
  }

  async removeHeaderImage(userId: number): Promise<PublicUser> {
    if (!userId) {
      throw new BadRequestException('Invalid user.');
    }

    await this.userEntityRepository.update(
      { id: userId },
      { headerImage: '' },
    );

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(updated);
  }

  toPublicUser(user: User): PublicUser {
    const { password, followers, following, ...rest } = user;

    const followersCount = Array.isArray(followers)
      ? followers.length
      : (user as any).followersCount ?? 0;
    const followingCount = Array.isArray(following)
      ? following.length
      : (user as any).followingCount ?? 0;

    return {
      ...(rest as PublicUser),
      followersCount,
      followingCount,
    };
  }

  toPublicUsers(users: User[]): PublicUser[] {
    return users.map((user) => this.toPublicUser(user));
  }

  private buildUsersQuery(): SelectQueryBuilder<User> {
    return this.userEntityRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');
  }

  private async ensureRoleExists(name: string) {
    const normalized = name.toLowerCase();
    const existing = await this.roleRepository.findOne({
      where: { name: normalized },
    });

    if (existing) {
      return existing;
    }

    return this.roleRepository.save(this.roleRepository.create({ name: normalized }));
  }
}
