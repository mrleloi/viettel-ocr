import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a batch upload.
 */
export class CreateBatchDto {
  /** Upload mode: 'single_ncc' or 'mixed' */
  @ApiProperty({ enum: ['single_ncc', 'mixed'], description: 'Upload mode' })
  @IsEnum(['single_ncc', 'mixed'])
  uploadMode!: string;

  /** Optional schema hint for classification */
  @ApiPropertyOptional({ description: 'Schema ID hint for single NCC upload' })
  @IsOptional()
  @IsString()
  hintSchemaId?: string;

  /** Duplicate handling policy */
  @ApiPropertyOptional({
    enum: ['skip', 'process_anyway', 'flag_only'],
    description: 'Duplicate handling policy (default: skip)',
    default: 'skip',
  })
  @IsOptional()
  @IsEnum(['skip', 'process_anyway', 'flag_only'])
  onDuplicate?: string;

  /** Auto-create schema for new invoice patterns */
  @ApiPropertyOptional({
    description: 'Auto-create schema when new invoice pattern detected (default: false)',
    default: false,
  })
  @IsOptional()
  // Multipart form-data sends booleans as strings — coerce 'true'/'1' → true.
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 1)
  @IsBoolean()
  autoCreateSchemaOnNewPattern?: boolean;
}
