import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for export job result.
 */
export class ExportResponseDto {
  @ApiProperty({ description: 'Export job ID' })
  exportId!: string;

  @ApiProperty({ description: 'Generated filename' })
  filename!: string;

  @ApiProperty({ description: 'Number of records exported' })
  recordCount!: number;

  @ApiProperty({ description: 'File size in bytes' })
  fileSizeBytes!: number;
}
