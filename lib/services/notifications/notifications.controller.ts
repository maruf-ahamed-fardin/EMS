import { Controller, Get, Global, Module, Param, Patch, Query } from '@nestjs/common';
import { type DataResponse, type ListResponse, type NotificationItem, notificationListQuery, type UnreadCount } from '@/lib/validations';
import { SkipThrottle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '@/lib/auth/auth-context';
import { NoAudit } from '@/lib/services/audit/audit-coverage';
import { CurrentAuth, RequirePermission } from '@/lib/auth/decorators';
import { InAppChannel, NOTIFICATION_CHANNELS, NotificationService } from './notifications.service';

class NotificationListQueryDto extends createZodDto(notificationListQuery) {}

/** Only ever the caller's own notifications; there is no scope to widen. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @RequirePermission('notification.view')
  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: NotificationListQueryDto): Promise<ListResponse<NotificationItem>> {
    return this.notifications.list(auth.user.id, query);
  }

  /** The header bell asks every minute from every open tab, so it doesn't count toward the rate limit. */
  @RequirePermission('notification.view')
  @SkipThrottle()
  @Get('unread-count')
  async unreadCount(@CurrentAuth() auth: AuthContext): Promise<DataResponse<UnreadCount>> {
    return { data: { count: await this.notifications.unreadCount(auth.user.id) } };
  }

  @RequirePermission('notification.view')
  @NoAudit('Only marks the caller’s own notifications as read')
  @Patch('read-all')
  async readAll(@CurrentAuth() auth: AuthContext): Promise<DataResponse<{ updated: number }>> {
    return { data: { updated: await this.notifications.markAllRead(auth.user.id) } };
  }

  @RequirePermission('notification.view')
  @NoAudit('Only marks the caller’s own notification as read')
  @Patch(':id/read')
  async read(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<NotificationItem>> {
    return { data: await this.notifications.markRead(auth.user.id, id) };
  }
}

/** Global, like audit: every module that changes something may need to tell someone. */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationService, { provide: NOTIFICATION_CHANNELS, useFactory: () => [new InAppChannel()] }],
  exports: [NotificationService],
})
export class NotificationsModule {}
