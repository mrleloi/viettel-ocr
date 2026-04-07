import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * DTO for editing extracted invoice data.
 */
export class EditInvoiceDto {
  /** Key-value map of field changes */
  @ApiProperty({
    description: 'Key-value map of field changes',
    example: { invoiceNumber: 'INV-001', total: 1000000 },
  })
  @IsObject()
  changes!: Record<string, unknown>;
}
