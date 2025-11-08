import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { PublicUser } from './users/users.service';

@Controller()
export class AuthMessageController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern('authenticate')
  authenticate(
    @Payload() payload: { Authentication?: string },
  ): Promise<PublicUser> {
    return this.authService.authenticate(payload?.Authentication);
  }
}
