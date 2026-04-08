import { Notification } from './notification.entity';

/**
 * Options for listing notifications.
 */
export interface ListNotificationsOptions {
  /** If true, return only unread notifications */
  unreadOnly?: boolean;
  /** Maximum number of notifications to return */
  limit?: number;
  /** Number of notifications to skip (for pagination) */
  offset?: number;
}

/**
 * Repository interface for Notification persistence.
 *
 * Lives in the domain layer — implementations in infrastructure.
 */
export interface INotificationRepository {
  /**
   * Find a notification by its unique identifier.
   * @param id - The notification ID
   * @returns The notification, or null if not found
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Find all notifications with optional filtering and pagination.
   * Results ordered by createdAt DESC (newest first).
   * @param options - Filtering and pagination options
   * @returns Array of notifications
   */
  findAll(options?: ListNotificationsOptions): Promise<Notification[]>;

  /**
   * Count the number of unread notifications.
   * @returns Number of unread notifications
   */
  countUnread(): Promise<number>;

  /**
   * Save (insert or update) a notification.
   * @param notification - The notification to save
   */
  save(notification: Notification): Promise<void>;

  /**
   * Mark a single notification as read.
   * @param id - The notification ID to mark as read
   */
  markAsRead(id: string): Promise<void>;

  /**
   * Mark all notifications as read.
   */
  markAllAsRead(): Promise<void>;
}
