import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import {
  NOTIFICATION_EVENT_EMAIL_VERIFICATION,
  NOTIFICATION_EVENT_EMAIL_WELCOME,
  NOTIFICATION_EVENT_POST_LIKED,
  NOTIFICATION_EVENT_POST_REPLIED,
} from '@app/common/constants';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern(NOTIFICATION_EVENT_EMAIL_VERIFICATION)
  handleEmailVerification(@Payload() payload: any) {
    return this.notificationsService.sendVerificationEmail(payload);
  }

  @EventPattern(NOTIFICATION_EVENT_EMAIL_WELCOME)
  handleWelcomeEmail(@Payload() payload: any) {
    return this.notificationsService.sendWelcomeEmail(payload);
  }

  @EventPattern(NOTIFICATION_EVENT_POST_LIKED)
  handlePostLiked(@Payload() payload: any) {
    return this.notificationsService.sendPostLikedEmail(payload);
  }

  @EventPattern(NOTIFICATION_EVENT_POST_REPLIED)
  handlePostReplied(@Payload() payload: any) {
    return this.notificationsService.sendPostRepliedEmail(payload);
  }

  @MessagePattern('notifications.list')
  async listNotifications(@Payload() payload: { userId: number; limit?: number; offset?: number }) {
    const { userId, limit, offset } = payload || {};
    return this.notificationsService.listByUser(userId, limit, offset);
  }

  @MessagePattern('notifications.markRead')
  async markNotificationsRead(
    @Payload() payload: { userId: number; ids: number[] },
  ) {
    const { userId, ids } = payload || {};
    return this.notificationsService.markRead(userId, ids ?? []);
  }
}
