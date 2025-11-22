import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, JwtAuthGuard } from '@app/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { User } from '@app/common/models';

@Resolver(() => Notification)
@UseGuards(JwtAuthGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => [Notification])
  async notifications(
    @CurrentUser() user: User,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ) {
    return this.notificationsService.listByUser(user?.id, limit, offset);
  }

  @Mutation(() => Boolean)
  async markNotificationsRead(
    @CurrentUser() user: User,
    @Args({ name: 'ids', type: () => [Int] }) ids: number[],
  ) {
    const result = await this.notificationsService.markRead(user?.id, ids);
    return (result?.updated ?? 0) > 0;
  }

  @Mutation(() => Boolean)
  async deleteNotification(
    @CurrentUser() user: User,
    @Args('id', { type: () => Int }) id: number,
  ) {
    return this.notificationsService.deleteNotification(user?.id, id);
  }
}
