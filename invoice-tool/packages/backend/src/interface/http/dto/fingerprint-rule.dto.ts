import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsInt, Min, IsIn } from 'class-validator';

/**
 * DTO for creating a fingerprint rule under a schema.
 */
export class CreateFingerprintRuleDto {
  @ApiProperty({ description: 'Rule type', enum: ['mst_exact', 'keyword', 'symbol_regex', 'custom'] })
  @IsIn(['mst_exact', 'keyword', 'symbol_regex', 'custom'])
  ruleType!: string;

  @ApiProperty({ description: 'Pattern to match against', example: '0102345678' })
  @IsString()
  pattern!: string;

  @ApiProperty({ description: 'Priority (higher = checked first)', minimum: 0, default: 0 })
  @IsInt()
  @Min(0)
  priority!: number;
}

/**
 * DTO for updating a fingerprint rule.
 */
export class UpdateFingerprintRuleDto {
  @ApiPropertyOptional({ description: 'Rule type', enum: ['mst_exact', 'keyword', 'symbol_regex', 'custom'] })
  @IsOptional()
  @IsIn(['mst_exact', 'keyword', 'symbol_regex', 'custom'])
  ruleType?: string;

  @ApiPropertyOptional({ description: 'Pattern to match against' })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({ description: 'Priority', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether the rule is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Response DTO for a fingerprint rule.
 */
export class FingerprintRuleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() schemaId!: string;
  @ApiProperty() ruleType!: string;
  @ApiProperty() pattern!: string;
  @ApiProperty() priority!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;
}
