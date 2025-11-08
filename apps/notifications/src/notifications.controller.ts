import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
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
}
