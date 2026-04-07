import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for batch data.
 */
export class BatchResponseDto {
  @ApiProperty({ description: 'Batch ID' })
  id!: string;

  @ApiProperty({ description: 'Batch status' })
  status!: string;

  @ApiProperty({ description: 'Upload mode' })
  uploadMode!: string;

  @ApiProperty({ description: 'Total files in batch' })
  totalFiles!: number;

  @ApiProperty({ description: 'Number of processed files' })
  processedFiles!: number;

  @ApiProperty({ description: 'Number of successful files' })
  successFiles!: number;

  @ApiProperty({ description: 'Number of error files' })
  errorFiles!: number;

  @ApiPropertyOptional({ description: 'Schema hint ID' })
  hintSchemaId?: string | null;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)' })
  createdAt!: string;
}

/**
 * Response DTO for upload batch result.
 */
export class UploadBatchResponseDto {
  @ApiProperty({ description: 'Created batch ID' })
  batchId!: string;

  @ApiProperty({ description: 'Total files submitted' })
  totalFiles!: number;

  @ApiProperty({ description: 'Number of accepted files' })
  acceptedFiles!: number;

  @ApiProperty({ description: 'Number of rejected files' })
  rejectedFiles!: number;

  @ApiProperty({ description: 'Number of duplicate files' })
  duplicateFiles!: number;
}
