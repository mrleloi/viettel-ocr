import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsInt, Min, IsIn } from 'class-validator';

/**
 * DTO for creating a field definition under a schema.
 */
export class CreateFieldDefinitionDto {
  @ApiProperty({ description: 'Field name (machine key)', example: 'invoice_number' })
  @IsString()
  fieldName!: string;

  @ApiProperty({ description: 'Display label', example: 'Số hóa đơn' })
  @IsString()
  displayName!: string;

  @ApiProperty({ description: 'Data type', enum: ['string', 'integer', 'number', 'date', 'boolean'], default: 'string' })
  @IsIn(['string', 'integer', 'number', 'date', 'boolean'])
  dataType!: string;

  @ApiProperty({ description: 'Whether the field is required', default: false })
  @IsBoolean()
  isRequired!: boolean;

  @ApiPropertyOptional({ description: 'JSON validation rules' })
  @IsOptional()
  @IsString()
  validationRules?: string;

  @ApiPropertyOptional({ description: 'Extraction hint for AI' })
  @IsOptional()
  @IsString()
  extractionHint?: string;

  @ApiPropertyOptional({ description: 'Output key for mapping to canonical schema' })
  @IsOptional()
  @IsString()
  outputKey?: string;

  @ApiProperty({ description: 'Sort order', minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

/**
 * DTO for updating a field definition.
 */
export class UpdateFieldDefinitionDto {
  @ApiPropertyOptional({ description: 'Display label' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Whether the field is required' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'JSON validation rules' })
  @IsOptional()
  @IsString()
  validationRules?: string;

  @ApiPropertyOptional({ description: 'Extraction hint for AI' })
  @IsOptional()
  @IsString()
  extractionHint?: string;

  @ApiPropertyOptional({ description: 'Output key for mapping' })
  @IsOptional()
  @IsString()
  outputKey?: string;

  @ApiPropertyOptional({ description: 'Sort order', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * Response DTO for a field definition.
 */
export class FieldDefinitionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() schemaId!: string;
  @ApiProperty() fieldName!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() dataType!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiPropertyOptional() validationRules!: string | null;
  @ApiPropertyOptional() extractionHint!: string | null;
  @ApiPropertyOptional() outputKey!: string | null;
  @ApiProperty() sortOrder!: number;
}
