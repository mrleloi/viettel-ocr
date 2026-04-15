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

  /** Optional date range start (ISO string) */
  @ApiPropertyOptional({ description: 'Date range start (ISO 8601)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** Optional date range end (ISO string) */
  @ApiPropertyOptional({ description: 'Date range end (ISO 8601)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  /** Optional status filter (e.g., 'approved') */
  @ApiPropertyOptional({ description: 'Filter by invoice status (e.g., approved)' })
  @IsOptional()
  @IsString()
  statusFilter?: string;
}
