import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { MailService } from './mail/mail.service';
import { NotificationRepository } from './notification.repository';
import { Notification } from './notification.entity';

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
  likerId?: number;
  likerProfilePhoto?: string | null;
  recipientUserId?: number;
  postId: number;
  postContent?: string;
}

interface PostRepliedPayload {
  email: string;
  replyUsername: string;
  replyUserId?: number;
  replyProfilePhoto?: string | null;
  recipientUserId?: number;
  postId: number;
  replyContent: string;
  replyId?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  private async createInAppNotification(data: Partial<Notification>) {
    if (!data?.userId) {
      this.logger.warn('Skipping in-app notification because userId is missing');
      return;
    }
    try {
      const payload =
        typeof data.payload === 'string'
          ? data.payload
          : data.payload
            ? JSON.stringify(data.payload)
            : null;

      await this.notificationRepository.repository.save({
        userId: Number(data.userId),
        type: data.type ?? 'unknown',
        actorUserId: data.actorUserId ?? null,
        actorUsername: data.actorUsername ?? null,
        actorProfilePhoto: data.actorProfilePhoto ?? null,
        postId: data.postId ?? null,
        payload,
        readAt: null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to store in-app notification for user ${data.userId}`,
        error as Error,
      );
    }
  }

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
    likerId,
    likerProfilePhoto,
    recipientUserId,
    postId,
    postContent,
  }: PostLikedPayload) {
    if (!email || !likerUsername || !postId || !recipientUserId) {
      this.logger.warn('Invalid post liked payload received');
      return;
    }

    await this.createInAppNotification({
      userId: recipientUserId,
      type: 'post_liked',
      actorUserId: likerId,
      actorUsername: likerUsername,
      actorProfilePhoto: likerProfilePhoto ?? null,
      postId,
      payload: postContent ? JSON.stringify({ postContent }) : null,
    });

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
    replyUserId,
    replyProfilePhoto,
    recipientUserId,
    replyContent,
    postId,
    replyId,
  }: PostRepliedPayload) {
    if (!email || !replyUsername || !replyContent || !postId || !recipientUserId) {
      this.logger.warn('Invalid post replied payload received');
      return;
    }

    await this.createInAppNotification({
      userId: recipientUserId,
      type: 'post_replied',
      actorUserId: replyUserId,
      actorUsername: replyUsername,
      actorProfilePhoto: replyProfilePhoto ?? null,
      postId,
      payload: JSON.stringify({
        replyContent,
        replyId,
      }),
    });

    await this.mailService.sendPostRepliedEmail(
      email,
      replyUsername,
      replyContent,
      postId,
    );
  }

  async listByUser(userId: number, limit = 50, offset = 0) {
    if (!userId) {
      return [];
    }
    return this.notificationRepository.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async markRead(userId: number, notificationIds: number[]) {
    if (!userId || !notificationIds?.length) {
      return { updated: 0 };
    }

    const result = await this.notificationRepository.repository.update(
      { userId, id: In(notificationIds) as any },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  async deleteNotification(userId: number, id: number) {
    if (!userId || !id) {
      return false;
    }
    const result = await this.notificationRepository.repository.delete({
      id,
      userId,
    });
    return (result.affected ?? 0) > 0;
  }
}
