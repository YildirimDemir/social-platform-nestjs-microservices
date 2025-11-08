import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { TokenPayload } from '../interfaces/token-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) =>
          request?.cookies?.Authentication ||
          request?.Authentication ||
          request?.headers.Authentication,
      ]),
      secretOrKey: secret,
    });
  }

  async validate({ userId }: TokenPayload) {
    const id = Number(userId);

    if (!id || Number.isNaN(id)) {
      throw new UnauthorizedException('Invalid token payload.');
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    return this.usersService.toPublicUser(user);
  }
}
