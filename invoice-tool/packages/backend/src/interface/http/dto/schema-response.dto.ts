import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for schema data.
 */
export class SchemaResponseDto {
  @ApiProperty({ description: 'Schema ID' })
  id!: string;

  @ApiProperty({ description: 'Schema display name' })
  name!: string;

  @ApiProperty({ description: 'NCC (supplier) name' })
  nccName!: string;

  @ApiProperty({ description: 'NCC tax ID (MST)' })
  nccTaxId!: string;

  @ApiProperty({ description: 'Schema status', enum: ['draft', 'active', 'archived'] })
  status!: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string | null;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)' })
  createdAt!: string;
}

/**
 * Response DTO for schema creation result.
 */
export class CreateSchemaResponseDto {
  @ApiProperty({ description: 'Created schema ID' })
  schemaId!: string;

  @ApiProperty({ description: 'Schema name' })
  name!: string;

  @ApiProperty({ description: 'Schema status (always draft for new schemas)' })
  status!: string;

  @ApiProperty({ description: 'Number of fingerprint rules created' })
  rulesCreated!: number;

  @ApiProperty({ description: 'Number of field definitions created' })
  fieldsCreated!: number;
}
