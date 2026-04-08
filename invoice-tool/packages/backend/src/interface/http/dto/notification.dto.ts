import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBooleanString } from 'class-validator';

/**
 * Response DTO for a single notification.
 */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id!: string;

  @ApiProperty({ description: 'Notification category', example: 'duplicate_detected' })
  category!: string;

  @ApiProperty({ description: 'Short notification title' })
  title!: string;

  @ApiProperty({ description: 'Detailed notification message' })
  message!: string;

  @ApiPropertyOptional({ description: 'Related entity type', nullable: true })
  relatedEntityType!: string | null;

  @ApiPropertyOptional({ description: 'Related entity ID', nullable: true })
  relatedEntityId!: string | null;

  @ApiProperty({ description: 'Whether the notification has been read' })
  isRead!: boolean;

  @ApiProperty({ description: 'ISO timestamp of creation' })
  createdAt!: string;
}

/**
 * Response DTO for listing notifications.
 */
export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto], description: 'List of notifications' })
  notifications!: NotificationResponseDto[];

  @ApiProperty({ description: 'Total unread notification count' })
  unreadCount!: number;
}

/**
 * Response DTO for unread count only.
 */
export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread notifications' })
  unreadCount!: number;
}

/**
 * Query DTO for listing notifications.
 */
export class ListNotificationsQueryDto {
  @IsOptional()
  @IsBooleanString()
  @ApiPropertyOptional({ description: 'If "true", return only unread notifications' })
  unreadOnly?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Maximum number of notifications to return' })
  limit?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Pagination offset' })
  offset?: string;
}
