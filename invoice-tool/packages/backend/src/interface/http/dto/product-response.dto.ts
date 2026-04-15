import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * Response DTO for product data.
 */
export class ProductResponseDto {
  @ApiProperty({ description: 'Product ID' })
  id!: string;

  @ApiProperty({ description: 'Product code' })
  productCode!: string;

  @ApiProperty({ description: 'Product name' })
  productName!: string;

  @ApiPropertyOptional({ description: 'Unit of measurement (cái, kg, m, etc.)' })
  unit?: string | null;

  @ApiPropertyOptional({ description: 'Product category' })
  category?: string | null;

  @ApiProperty({ description: 'Whether the product is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Sync status', enum: ['synced', 'local_only', 'conflict'] })
  syncStatus!: string;

  @ApiPropertyOptional({ description: 'Last synced timestamp (ISO 8601)' })
  lastSyncedAt?: string | null;
}

/**
 * Input DTO for resolving a sync conflict.
 */
export class ResolveConflictDto {
  @ApiProperty({
    description: 'Resolution action',
    enum: ['keep_local', 'accept_remote', 'ignore'],
  })
  @IsIn(['keep_local', 'accept_remote', 'ignore'])
  action!: 'keep_local' | 'accept_remote' | 'ignore';
}

/**
 * Response DTO for a sync conflict.
 */
export class ConflictResponseDto {
  @ApiProperty({ description: 'Conflict ID' })
  id!: string;

  @ApiProperty({ description: 'Product ID the conflict belongs to' })
  productId!: string;

  @ApiProperty({ description: 'Field name that has the conflict' })
  fieldName!: string;

  @ApiProperty({ description: 'Current local value' })
  localValue!: string;

  @ApiProperty({ description: 'Incoming remote value' })
  remoteValue!: string;

  @ApiProperty({ description: 'Conflict created at (ISO 8601)' })
  createdAt!: string;
}

/**
 * Response DTO for product sync result.
 */
export class SyncResultDto {
  @ApiProperty({ description: 'Total products fetched from API' })
  totalFetched!: number;

  @ApiProperty({ description: 'New products created' })
  created!: number;

  @ApiProperty({ description: 'Existing products updated' })
  updated!: number;

  @ApiProperty({ description: 'Conflicts detected' })
  conflictsDetected!: number;
}
