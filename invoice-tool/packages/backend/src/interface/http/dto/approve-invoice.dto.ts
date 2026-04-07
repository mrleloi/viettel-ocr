import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for approving an invoice after review.
 */
export class ApproveInvoiceDto {
  /** Reviewer identifier */
  @ApiProperty({ description: 'Reviewer identifier' })
  @IsString()
  reviewedBy!: string;

  /** Optional reviewer note */
  @ApiPropertyOptional({ description: 'Optional reviewer note' })
  @IsOptional()
  @IsString()
  notes?: string;
}
