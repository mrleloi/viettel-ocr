import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * DTO for creating an export job.
 */
export class CreateExportDto {
  /** Export format */
  @ApiProperty({ enum: ['csv', 'json', 'xlsx'], description: 'Export file format' })
  @IsEnum(['csv', 'json', 'xlsx'])
  format!: 'csv' | 'json' | 'xlsx';

  /** Optional batch ID filter */
  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  /** Optional schema ID filter */
  @ApiPropertyOptional({ description: 'Filter by schema ID' })
  @IsOptional()
  @IsString()
  schemaId?: string;

  /** Invoice-date range start (YYYY-MM-DD, inclusive) — filter by the date printed on the invoice. */
  @ApiPropertyOptional({ description: 'Invoice-date range start (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** Invoice-date range end (YYYY-MM-DD, inclusive). */
  @ApiPropertyOptional({ description: 'Invoice-date range end (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  /** Processed-date range start (YYYY-MM-DD, inclusive) — filter by the system date when the file was processed. */
  @ApiPropertyOptional({ description: 'Processed-date range start (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  processedFrom?: string;

  /** Processed-date range end (YYYY-MM-DD, inclusive). */
  @ApiPropertyOptional({ description: 'Processed-date range end (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  processedTo?: string;

  /** Optional status filter (e.g., 'approved') */
  @ApiPropertyOptional({ description: 'Filter by invoice status (e.g., approved)' })
  @IsOptional()
  @IsString()
  statusFilter?: string;
}
