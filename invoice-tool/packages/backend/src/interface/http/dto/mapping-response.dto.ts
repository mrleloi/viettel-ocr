import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for mapping data.
 */
export class MappingResponseDto {
  @ApiProperty({ description: 'Mapping ID' })
  id!: string;

  @ApiProperty({ description: 'Schema ID' })
  schemaId!: string;

  @ApiProperty({ description: 'Partner product name' })
  partnerProductName!: string;

  @ApiProperty({ description: 'Viettel product code' })
  viettelProductCode!: string;

  @ApiPropertyOptional({ description: 'Viettel product name' })
  viettelProductName?: string | null;

  @ApiProperty({ description: 'Mapping status' })
  status!: string;

  @ApiProperty({ description: 'Mapping source', enum: ['manual', 'auto_learned', 'bulk_import', 'fuzzy_confirmed'] })
  source!: string;

  @ApiPropertyOptional({ description: 'Confidence score (0-1)' })
  confidence?: number | null;
}
