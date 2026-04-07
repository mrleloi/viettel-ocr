import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for invoice data.
 */
export class InvoiceResponseDto {
  @ApiProperty({ description: 'Invoice ID' })
  id!: string;

  @ApiProperty({ description: 'Batch ID' })
  batchId!: string;

  @ApiProperty({ description: 'Invoice status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Invoice number' })
  invoiceNumber?: string | null;

  @ApiPropertyOptional({ description: 'Invoice symbol' })
  invoiceSymbol?: string | null;

  @ApiPropertyOptional({ description: 'Invoice date' })
  invoiceDate?: string | null;

  @ApiPropertyOptional({ description: 'Invoice type' })
  invoiceType?: string | null;

  @ApiPropertyOptional({ description: 'Seller name' })
  sellerName?: string | null;

  @ApiPropertyOptional({ description: 'Seller tax ID' })
  sellerTaxId?: string | null;

  @ApiPropertyOptional({ description: 'Buyer name' })
  buyerName?: string | null;

  @ApiPropertyOptional({ description: 'Buyer tax ID' })
  buyerTaxId?: string | null;

  @ApiPropertyOptional({ description: 'Subtotal amount' })
  subtotal?: number | null;

  @ApiPropertyOptional({ description: 'VAT rate (percentage)' })
  vatRate?: number | null;

  @ApiPropertyOptional({ description: 'VAT amount' })
  vatAmount?: number | null;

  @ApiPropertyOptional({ description: 'Total amount' })
  total?: number | null;

  @ApiPropertyOptional({ description: 'Confidence score (0-1)' })
  confidenceScore?: number | null;

  @ApiPropertyOptional({ description: 'Schema ID' })
  schemaId?: string | null;

  @ApiProperty({ description: 'Original filename' })
  originalFilename!: string;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)' })
  createdAt!: string;
}

/**
 * Response DTO for approve/reject result.
 */
export class InvoiceActionResponseDto {
  @ApiProperty({ description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ description: 'Previous status' })
  previousStatus!: string;

  @ApiProperty({ description: 'New status' })
  newStatus!: string;
}

/**
 * Response DTO for edit result.
 */
export class InvoiceEditResponseDto {
  @ApiProperty({ description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ description: 'List of updated field names', type: [String] })
  updatedFields!: string[];
}
