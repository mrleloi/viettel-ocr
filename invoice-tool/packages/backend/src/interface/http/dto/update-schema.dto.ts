import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

/**
 * DTO for updating a schema.
 */
export class UpdateSchemaDto {
  /** Optional new name */
  @ApiPropertyOptional({ description: 'New schema name' })
  @IsOptional()
  @IsString()
  name?: string;

  /** Optional new description */
  @ApiPropertyOptional({ description: 'New description' })
  @IsOptional()
  @IsString()
  description?: string;

  /** Optional new NCC name */
  @ApiPropertyOptional({ description: 'New NCC name' })
  @IsOptional()
  @IsString()
  nccName?: string;

  /** Optional new prompt template */
  @ApiPropertyOptional({ description: 'New prompt template for AI extraction' })
  @IsOptional()
  @IsString()
  promptTemplate?: string;

  /** Optional status action */
  @ApiPropertyOptional({ enum: ['activate', 'deactivate'], description: 'Status transition action' })
  @IsOptional()
  @IsEnum(['activate', 'deactivate'])
  statusAction?: 'activate' | 'deactivate';
}
