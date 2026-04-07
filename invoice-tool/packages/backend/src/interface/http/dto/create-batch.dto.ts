import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
}
