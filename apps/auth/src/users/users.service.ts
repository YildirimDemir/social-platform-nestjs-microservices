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

interface CreateUserOptions {
  username: string;
  email: string;
  password: string;
  roles: Role[];
}

export type PublicUser = Omit<User, 'password'>;

export interface PaginatedUsersResult {
  items: PublicUser[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectRepository(User)
    private readonly userEntityRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
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
      relations: { roles: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toPublicUser(user);
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

  toPublicUser(user: User): PublicUser {
    const { password, ...rest } = user;
    return rest;
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
