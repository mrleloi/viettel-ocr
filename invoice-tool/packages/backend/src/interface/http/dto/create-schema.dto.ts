import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Nested DTO for fingerprint rules in schema creation.
 */
export class FingerprintRuleDto {
  @ApiProperty({ description: 'Rule type', enum: ['mst_exact', 'keyword', 'symbol_regex', 'custom'] })
  @IsString()
  ruleType!: string;

  @ApiProperty({ description: 'Pattern to match' })
  @IsString()
  pattern!: string;

  @ApiProperty({ description: 'Rule priority (lower = higher priority)' })
  @IsNumber()
  priority!: number;
}

/**
 * Nested DTO for field definitions in schema creation.
 */
export class FieldDefinitionDto {
  @ApiProperty({ description: 'Field name (programmatic)' })
  @IsString()
  fieldName!: string;

  @ApiProperty({ description: 'Display name (human-readable)' })
  @IsString()
  displayName!: string;

  @ApiProperty({ description: 'Data type', enum: ['string', 'number', 'date', 'boolean'] })
  @IsString()
  dataType!: string;

  @ApiProperty({ description: 'Whether this field is required' })
  @IsBoolean()
  isRequired!: boolean;

  @ApiPropertyOptional({ description: 'Hint for AI extraction' })
  @IsOptional()
  @IsString()
  extractionHint?: string;
}

/**
 * DTO for creating a schema.
 */
export class CreateSchemaDto {
  /** Schema display name */
  @ApiProperty({ description: 'Schema display name' })
  @IsString()
  name!: string;

  /** NCC (supplier) name */
  @ApiProperty({ description: 'NCC (supplier) name' })
  @IsString()
  nccName!: string;

  /** NCC tax ID (MST) */
  @ApiProperty({ description: 'NCC tax ID (MST)' })
  @IsString()
  nccTaxId!: string;

  /** Optional description */
  @ApiPropertyOptional({ description: 'Schema description' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Optional prompt template */
  @ApiPropertyOptional({ description: 'Prompt template for AI extraction' })
  @IsOptional()
  @IsString()
  promptTemplate?: string;

  /** Optional fingerprint rules */
  @ApiPropertyOptional({ description: 'Fingerprint rules', type: [FingerprintRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FingerprintRuleDto)
  fingerprintRules?: FingerprintRuleDto[];

  /** Optional field definitions */
  @ApiPropertyOptional({ description: 'Field definitions', type: [FieldDefinitionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fieldDefinitions?: FieldDefinitionDto[];
}
