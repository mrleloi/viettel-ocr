import { Inject, Injectable } from '@nestjs/common';
import { eq, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../connection';
import { AppDatabase } from '../connection';
import { notifications } from '../schema';
import {
  Notification,
  NotificationCategory,
  NotificationEntityType,
} from '../../../domain/notification/notification.entity';
import {
  INotificationRepository,
  ListNotificationsOptions,
} from '../../../domain/notification/notification.repository';

/**
 * Drizzle + SQLite implementation of INotificationRepository.
 *
 * Maps between the Notification domain entity and the `notifications` DB table.
 */
@Injectable()
export class NotificationRepositoryImpl implements INotificationRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: AppDatabase,
  ) {}

  /**
   * Find a notification by ID.
   * @param id - Notification ID
   * @returns The notification, or null if not found
   */
  async findById(id: string): Promise<Notification | null> {
    const row = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .get();

    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  /**
   * Find all notifications with optional filtering and pagination.
   * @param options - Filter and pagination options
   * @returns Array of notifications, newest first
   */
  async findAll(options?: ListNotificationsOptions): Promise<Notification[]> {
    const { unreadOnly = false, limit, offset } = options ?? {};

    const baseQuery = this.db.select().from(notifications);
    const filtered = unreadOnly
      ? baseQuery.where(eq(notifications.isRead, false))
      : baseQuery;

    let finalQuery = filtered.orderBy(desc(notifications.createdAt));

    if (limit !== undefined || offset !== undefined) {
      finalQuery = finalQuery.limit(limit ?? 999999) as typeof finalQuery;
    }

    if (offset !== undefined) {
      finalQuery = finalQuery.offset(offset) as typeof finalQuery;
    }

    const rows = await finalQuery.all();
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Count unread notifications.
   * @returns Number of unread notifications
   */
  async countUnread(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .all();

    return result[0]?.count ?? 0;
  }

  /**
   * Save (upsert) a notification.
   * @param notification - The notification entity to save
   */
  async save(notification: Notification): Promise<void> {
    const data = {
      id: notification.id,
      category: notification.category,
      title: notification.title,
      message: notification.message,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };

    this.db
      .insert(notifications)
      .values(data)
      .onConflictDoUpdate({
        target: notifications.id,
        set: {
          category: data.category,
          title: data.title,
          message: data.message,
          relatedEntityType: data.relatedEntityType,
          relatedEntityId: data.relatedEntityId,
          isRead: data.isRead,
        },
      })
      .run();
  }

  /**
   * Mark a single notification as read.
   * @param id - Notification ID
   */
  async markAsRead(id: string): Promise<void> {
    this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .run();
  }

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(): Promise<void> {
    this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.isRead, false))
      .run();
  }

  /**
   * Map a DB row to a Notification domain entity.
   * @param row - Raw DB row
   * @returns Notification domain entity
   */
  private toDomain(row: typeof notifications.$inferSelect): Notification {
    return Notification.reconstitute({
      id: row.id,
      category: row.category as NotificationCategory,
      title: row.title,
      message: row.message,
      relatedEntityType: (row.relatedEntityType as NotificationEntityType) ?? null,
      relatedEntityId: row.relatedEntityId ?? null,
      isRead: row.isRead,
      createdAt: new Date(row.createdAt),
    });
  }
}
