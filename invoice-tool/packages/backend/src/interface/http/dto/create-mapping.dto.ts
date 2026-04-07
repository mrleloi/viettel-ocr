import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for creating a product mapping.
 */
export class CreateMappingDto {
  /** Schema ID this mapping belongs to */
  @ApiProperty({ description: 'Schema ID' })
  @IsString()
  schemaId!: string;

  /** Partner product name (as it appears on invoices) */
  @ApiProperty({ description: 'Partner product name as it appears on invoices' })
  @IsString()
  partnerProductName!: string;

  /** Viettel product code to map to */
  @ApiProperty({ description: 'Viettel product code' })
  @IsString()
  viettelProductCode!: string;

  /** Optional Viettel product name */
  @ApiPropertyOptional({ description: 'Viettel product name' })
  @IsOptional()
  @IsString()
  viettelProductName?: string;

  /** Mapping source */
  @ApiProperty({ enum: ['manual', 'auto_learned', 'bulk_import', 'fuzzy_confirmed'], description: 'Mapping source' })
  @IsEnum(['manual', 'auto_learned', 'bulk_import', 'fuzzy_confirmed'])
  source!: 'manual' | 'auto_learned' | 'bulk_import' | 'fuzzy_confirmed';

  /** Optional confidence score */
  @ApiPropertyOptional({ description: 'Confidence score (0-1)', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
