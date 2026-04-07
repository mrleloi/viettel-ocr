import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for rejecting an invoice.
 */
export class RejectInvoiceDto {
  /** Reviewer identifier */
  @ApiProperty({ description: 'Reviewer identifier' })
  @IsString()
  reviewedBy!: string;

  /** Rejection reason (required, non-empty) */
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
