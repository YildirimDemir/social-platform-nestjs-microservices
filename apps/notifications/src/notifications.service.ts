import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail/mail.service';

interface VerificationPayload {
  email: string;
  code: string;
}

interface WelcomePayload {
  email: string;
  username: string;
}

interface PostLikedPayload {
  email: string;
  likerUsername: string;
  postId: number;
  postContent?: string;
}

interface PostRepliedPayload {
  email: string;
  replyUsername: string;
  postId: number;
  replyContent: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly mailService: MailService) {}

  async sendVerificationEmail({ email, code }: VerificationPayload) {
    if (!email || !code) {
      this.logger.warn('Invalid verification payload received');
      return;
    }

    await this.mailService.sendVerificationEmail(email, code);
  }

  async sendWelcomeEmail({ email, username }: WelcomePayload) {
    if (!email || !username) {
      this.logger.warn('Invalid welcome payload received');
      return;
    }

    await this.mailService.sendWelcomeEmail(email, username);
  }

  async sendPostLikedEmail({
    email,
    likerUsername,
    postId,
    postContent,
  }: PostLikedPayload) {
    if (!email || !likerUsername || !postId) {
      this.logger.warn('Invalid post liked payload received');
      return;
    }

    await this.mailService.sendPostLikedEmail(
      email,
      likerUsername,
      postContent,
      postId,
    );
  }

  async sendPostRepliedEmail({
    email,
    replyUsername,
    replyContent,
    postId,
  }: PostRepliedPayload) {
    if (!email || !replyUsername || !replyContent || !postId) {
      this.logger.warn('Invalid post replied payload received');
      return;
    }

    await this.mailService.sendPostRepliedEmail(
      email,
      replyUsername,
      replyContent,
      postId,
    );
  }
}
