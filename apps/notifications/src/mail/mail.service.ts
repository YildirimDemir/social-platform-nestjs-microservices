import { Inject, Injectable, Logger } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import { MAIL_FROM, MAIL_TRANSPORTER } from './mail.constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORTER) private readonly transporter: Transporter,
    @Inject(MAIL_FROM) private readonly defaultFrom: string,
  ) {}

  async sendVerificationEmail(email: string, code: string) {
    await this.transporter.sendMail({
      from: this.defaultFrom,
      to: email,
      subject: 'Email Verification Code',
      html: `<p>Hello,</p><p>Your verification code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code is valid for 5 minutes.</p>`,
    });
    this.logger.log(`Verification email sent to ${email}`);
  }

  async sendWelcomeEmail(email: string, username: string) {
    await this.transporter.sendMail({
      from: this.defaultFrom,
      to: email,
      subject: 'Welcome to the platform!',
      html: `<p>Hi ${username},</p><p>Welcome to the platform! 🎉</p><p>Enjoy your stay.</p>`,
    });
    this.logger.log(`Welcome email sent to ${email}`);
  }

  async sendPostLikedEmail(
    email: string,
    likerUsername: string,
    postContent: string | undefined,
    postId: number,
  ) {
    const preview = postContent?.slice(0, 120) ?? 'Your post';
    await this.transporter.sendMail({
      from: this.defaultFrom,
      to: email,
      subject: `${likerUsername} liked your post`,
      html: `<p>Hey there,</p><p><strong>${likerUsername}</strong> just liked your post:</p><blockquote>${preview}</blockquote><p><a href="${this.buildPostLink(postId)}">View the post</a></p>`,
    });
    this.logger.log(`Post liked email sent to ${email} for post ${postId}`);
  }

  async sendPostRepliedEmail(
    email: string,
    replyUsername: string,
    replyContent: string,
    postId: number,
  ) {
    const preview = replyContent.slice(0, 200);
    await this.transporter.sendMail({
      from: this.defaultFrom,
      to: email,
      subject: `${replyUsername} replied to your post`,
      html: `<p>Hi,</p><p><strong>${replyUsername}</strong> replied to your post:</p><blockquote>${preview}</blockquote><p><a href="${this.buildPostLink(postId)}">Open the conversation</a></p>`,
    });
    this.logger.log(`Post reply email sent to ${email} for post ${postId}`);
  }

  private buildPostLink(postId: number) {
    return `${process.env.APP_URL ?? 'http://localhost:4000'}/posts/${postId}`;
  }
}
