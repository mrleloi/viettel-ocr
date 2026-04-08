import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification/notification.repository';
import type { NotificationPlainObject } from '../../domain/notification/notification.entity';

/**
 * Input for listing notifications.
 */
export interface ListNotificationsInput {
  /** If true, return only unread notifications */
  unreadOnly?: boolean;
  /** Maximum number to return */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Output from listing notifications.
 */
export interface ListNotificationsOutput {
  /** Array of notification DTOs */
  notifications: NotificationPlainObject[];
  /** Total unread count (always computed, regardless of filters) */
  unreadCount: number;
}

/**
 * Use case: List notifications with optional filtering and pagination.
 * Always includes the total unread count for the badge.
 */
@Injectable()
export class ListNotificationsUseCase {
  constructor(
    @Inject('INotificationRepository')
    private readonly notificationRepo: INotificationRepository,
  ) {}

  /**
   * List notifications.
   * @param input - Filtering and pagination options
   * @returns Paginated notifications + unread count
   */
  async execute(input: ListNotificationsInput): Promise<ListNotificationsOutput> {
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepo.findAll({
        unreadOnly: input.unreadOnly,
        limit: input.limit,
        offset: input.offset,
      }),
      this.notificationRepo.countUnread(),
    ]);

    return {
      notifications: notifications.map((n) => n.toPlainObject()),
      unreadCount,
    };
  }
}
