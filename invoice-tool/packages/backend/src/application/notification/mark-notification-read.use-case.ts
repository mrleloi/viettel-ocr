import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../domain/notification/notification.repository';

/**
 * Input for marking notification(s) as read.
 */
export interface MarkNotificationReadInput {
  /** Specific notification ID. If omitted, marks ALL as read. */
  id?: string;
}

/**
 * Use case: Mark a single notification or all notifications as read.
 */
@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject('INotificationRepository')
    private readonly notificationRepo: INotificationRepository,
  ) {}

  /**
   * Mark notification(s) as read.
   * @param input - Optional notification ID. Omit to mark all.
   */
  async execute(input: MarkNotificationReadInput): Promise<void> {
    if (input.id) {
      await this.notificationRepo.markAsRead(input.id);
    } else {
      await this.notificationRepo.markAllAsRead();
    }
  }
}
