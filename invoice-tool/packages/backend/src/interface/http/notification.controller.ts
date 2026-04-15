import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ListNotificationsUseCase } from '../../application/notification/list-notifications.use-case';
import { MarkNotificationReadUseCase } from '../../application/notification/mark-notification-read.use-case';
import {
  NotificationListResponseDto,
  UnreadCountResponseDto,
  ListNotificationsQueryDto,
} from './dto/notification.dto';

/**
 * NotificationController — REST endpoints for notification management.
 *
 * Provides:
 * - GET /api/notifications — list notifications with filtering/pagination
 * - GET /api/notifications/unread-count — get unread badge count
 * - POST /api/notifications/:id/read — mark single notification as read
 * - POST /api/notifications/read-all — mark all as read
 */
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markNotificationRead: MarkNotificationReadUseCase,
  ) {}

  /**
   * List notifications with optional filtering and pagination.
   * @param query - Query parameters (unreadOnly, limit, offset)
   * @returns Paginated notification list + unread count
   */
  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: String, description: 'If "true", return only unread' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Max results' })
  @ApiQuery({ name: 'offset', required: false, type: String, description: 'Pagination offset' })
  @ApiResponse({ status: 200, description: 'Notification list', type: NotificationListResponseDto })
  async list(@Query() query: ListNotificationsQueryDto): Promise<NotificationListResponseDto> {
    const result = await this.listNotifications.execute({
      unreadOnly: query.unreadOnly === 'true' ? true : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return {
      notifications: result.notifications.map((n) => ({
        id: n.id,
        category: n.category,
        title: n.title,
        message: n.message,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount: result.unreadCount,
    };
  }

  /**
   * Get the unread notification count (for the bell badge).
   * @returns Unread count
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count', type: UnreadCountResponseDto })
  async getUnreadCount(): Promise<UnreadCountResponseDto> {
    const result = await this.listNotifications.execute({ unreadOnly: true, limit: 0 });
    return { unreadCount: result.unreadCount };
  }

  /**
   * Mark all notifications as read.
   * @returns void
   */
  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 204, description: 'All marked as read' })
  async markAllRead(): Promise<void> {
    await this.markNotificationRead.execute({});
  }

  /**
   * Mark a single notification as read.
   * @param id - Notification ID
   * @returns void
   */
  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 204, description: 'Marked as read' })
  async markRead(@Param('id') id: string): Promise<void> {
    await this.markNotificationRead.execute({ id });
  }
}
