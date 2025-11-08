import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from './users/users.service';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import {
  NOTIFICATION_EVENT_EMAIL_VERIFICATION,
  NOTIFICATION_EVENT_EMAIL_WELCOME,
  NOTIFICATIONS_SERVICE,
} from '@app/common';
import { generateVerificationCode } from './utils/generate-verification-code';
import { hashValue } from './utils/hash.util';
import { TokenPayload } from './interfaces/token-payload.interface';
import { PublicUser } from './users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsClient: ClientProxy,
  ) {}

  async sendVerificationCode({ email }: SendVerificationCodeDto) {
    const normalizedEmail = email.toLowerCase();

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    const code = generateVerificationCode();
    await this.cache.set(`verify:${normalizedEmail}`, code, {
      ttl: 60 * 5,
    } as any);

    await lastValueFrom(
      this.notificationsClient.emit(
        NOTIFICATION_EVENT_EMAIL_VERIFICATION,
        {
          email: normalizedEmail,
          code,
        },
      ),
    );

    return { message: 'Verification code sent.' };
  }

  async verifyEmailCode({ email, code }: VerifyEmailCodeDto) {
    const normalizedEmail = email.toLowerCase();

    const storedCode = await this.cache.get<string>(`verify:${normalizedEmail}`);
    if (!storedCode || storedCode !== code) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    await this.cache.del(`verify:${normalizedEmail}`);
    await this.cache.set(`verified:${normalizedEmail}`, true, {
      ttl: 60 * 10,
    } as any);

    return { message: 'Email verified.' };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase();

    const isVerified = await this.cache.get<boolean>(`verified:${normalizedEmail}`);
    if (!isVerified) {
      throw new BadRequestException('Please verify your email first.');
    }

    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Passwords do not match.');
    }

    const [existingEmail, existingUsername] = await Promise.all([
      this.usersService.findByEmail(normalizedEmail),
      this.usersService.findByUsername(dto.username),
    ]);

    if (existingEmail) {
      throw new BadRequestException('Email is already registered.');
    }

    if (existingUsername) {
      throw new BadRequestException('Username is already taken.');
    }

    const roles = await this.usersService.resolveRoles(
      dto.roles?.map((role) => role.name),
    );

    const hashedPassword = await hashValue(dto.password, this.configService);

    const user = await this.usersService.createUser({
      username: dto.username,
      email: normalizedEmail,
      password: hashedPassword,
      roles,
    });

    await this.cache.del(`verified:${normalizedEmail}`);

    await lastValueFrom(
      this.notificationsClient.emit(
        NOTIFICATION_EVENT_EMAIL_WELCOME,
        {
          email: user.email,
          username: user.username,
        },
      ),
    );

    return {
      message: 'User registered successfully.',
      user,
    };
  }

  async deleteAccount(userId: number, email: string) {
    if (!userId) {
      throw new BadRequestException('Invalid user.');
    }

    await this.usersService.deleteUserById(userId);

    await Promise.all([
      this.cache.del(`verified:${email?.toLowerCase?.()}`),
      this.cache.del(`verify:${email?.toLowerCase?.()}`),
    ]);

    return { message: 'Account deleted successfully.' };
  }

  async login(user: PublicUser, response: Response) {
    const tokenPayload: TokenPayload = {
      userId: user.id,
    };

    const expirationSeconds = Number(
      this.configService.get<string | number>('JWT_EXPIRATION', 3600),
    );

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      expiresIn: expirationSeconds,
    });

    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + expirationSeconds);

    const secureCookie =
      this.configService.get<string>('COOKIE_SECURE', 'false') === 'true';
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAMESITE',
      'lax',
    );

    response.cookie('Authentication', accessToken, {
      httpOnly: true,
      expires,
      sameSite,
      secure: secureCookie,
    });

    return {
      message: 'Login successful.',
      accessToken,
      expiresAt: expires.toISOString(),
      user,
    };
  }

  async logout(response: Response) {
    const secureCookie =
      this.configService.get<string>('COOKIE_SECURE', 'false') === 'true';
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAMESITE',
      'lax',
    );

    response.cookie('Authentication', '', {
      httpOnly: true,
      expires: new Date(0),
      sameSite,
      secure: secureCookie,
    });

    return { message: 'Logout successful.' };
  }

  async authenticate(authentication?: string): Promise<PublicUser> {
    if (!authentication) {
      throw new UnauthorizedException('Authentication token missing.');
    }

    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(authentication);
    } catch {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const userId = Number(payload.userId);

    if (!userId || Number.isNaN(userId)) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return this.usersService.toPublicUser(user);
  }
}
