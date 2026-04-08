import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  Notification,
  NotificationCategory,
  NotificationEntityType,
} from '../../domain/notification/notification.entity';
import type { INotificationRepository } from '../../domain/notification/notification.repository';
import type { EventBusService } from '../../interface/http/event-bus.service';

/**
 * Input to create a notification.
 */
export interface CreateNotificationInput {
  /** Notification category */
  category: NotificationCategory;
  /** Short title */
  title: string;
  /** Detailed message */
  message: string;
  /** Type of related entity for navigation */
  relatedEntityType?: NotificationEntityType | null;
  /** ID of the related entity */
  relatedEntityId?: string | null;
}

/**
 * Output after creating a notification.
 */
export interface CreateNotificationOutput {
  /** Generated notification ID */
  id: string;
  /** Notification category */
  category: string;
  /** Notification title */
  title: string;
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Use case: Create a new notification, persist it, and emit an SSE event.
 *
 * Called by other use cases (Upload, Process, SyncProducts) when business
 * events occur that the user should be notified about.
 */
@Injectable()
export class CreateNotificationUseCase {
  private readonly logger = new Logger(CreateNotificationUseCase.name);

  constructor(
    @Inject('INotificationRepository')
    private readonly notificationRepo: INotificationRepository,
    @Optional()
    @Inject('EventBusService')
    private readonly eventBus?: EventBusService,
  ) {}

  /**
   * Create, persist, and emit a notification.
   * @param input - Notification creation input
   * @returns The created notification metadata
   */
  async execute(input: CreateNotificationInput): Promise<CreateNotificationOutput> {
    const notification = Notification.create({
      category: input.category,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    });

    await this.notificationRepo.save(notification);

    // Emit SSE event — failure should not break the main flow
    try {
      if (this.eventBus) {
        this.eventBus.emit({
          type: 'notification.created',
          data: {
            id: notification.id,
            category: notification.category,
            title: notification.title,
            message: notification.message,
            relatedEntityType: notification.relatedEntityType,
            relatedEntityId: notification.relatedEntityId,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.warn('Failed to emit notification SSE event', error);
    }

    return {
      id: notification.id,
      category: notification.category,
      title: notification.title,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
