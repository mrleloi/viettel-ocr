import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for a processing trace record.
 */
export class ProcessingTraceResponseDto {
  @ApiProperty({ description: 'Trace ID' })
  id!: string;

  @ApiProperty({ description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ description: 'Pipeline stage name (classify, extract, validate, score, route)' })
  stage!: string;

  @ApiProperty({ description: 'Stage execution status (completed, failed)' })
  status!: string;

  @ApiPropertyOptional({ description: 'Serialized stage input data' })
  inputData?: string | null;

  @ApiPropertyOptional({ description: 'Serialized stage output data' })
  outputData?: string | null;

  @ApiPropertyOptional({ description: 'Error message if stage failed' })
  errorMessage?: string | null;

  @ApiPropertyOptional({ description: 'Stage duration in milliseconds' })
  durationMs?: number | null;

  @ApiProperty({ description: 'When this trace was created (ISO 8601)' })
  createdAt!: string;
}
