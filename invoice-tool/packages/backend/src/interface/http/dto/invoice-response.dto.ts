import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineItemResponseDto } from './line-item-response.dto';

/**
 * Full response DTO for an invoice, including all extraction and processing data.
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

  // --- New fields for review depth (Session 20) ---

  @ApiPropertyOptional({ description: 'Line items extracted from the invoice', type: [LineItemResponseDto] })
  lineItems?: LineItemResponseDto[] | null;

  @ApiPropertyOptional({ description: 'Raw OCR text from AI model' })
  ocrRawText?: string | null;

  @ApiPropertyOptional({ description: 'Raw extracted JSON from AI model' })
  extractedRawJson?: string | null;

  @ApiPropertyOptional({ description: 'Per-field confidence scores (parsed JSON object)' })
  fieldConfidences?: Record<string, number> | null;

  @ApiPropertyOptional({ description: 'Validation errors and warnings' })
  validationErrors?: { errors: string[]; warnings: string[] } | null;

  @ApiPropertyOptional({ description: 'Classification method (fingerprint, llm, manual, frontend_hint)' })
  classificationMethod?: string | null;

  @ApiPropertyOptional({ description: 'Classification confidence score (0-1)' })
  classificationConfidence?: number | null;

  @ApiPropertyOptional({ description: 'File storage path (relative)' })
  storagePath?: string | null;

  @ApiPropertyOptional({ description: 'PDF page count' })
  pageCount?: number | null;

  @ApiPropertyOptional({ description: 'SHA-256 file hash' })
  fileHash?: string | null;

  @ApiPropertyOptional({ description: 'PO number' })
  poNumber?: string | null;

  @ApiPropertyOptional({ description: 'ID of original invoice if this is a duplicate' })
  duplicateOf?: string | null;

  @ApiPropertyOptional({ description: 'Processing completed timestamp (ISO 8601)' })
  processedAt?: string | null;

  @ApiPropertyOptional({ description: 'Review completed timestamp (ISO 8601)' })
  reviewedAt?: string | null;

  @ApiPropertyOptional({ description: 'Reviewer identifier' })
  reviewedBy?: string | null;

  @ApiPropertyOptional({ description: 'Last updated timestamp (ISO 8601)' })
  updatedAt?: string | null;
}

/**
 * Response DTO for invoice review actions (approve, reject, reprocess).
 */
export class InvoiceActionResponseDto {
  @ApiProperty({ description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ description: 'Previous status before the action' })
  previousStatus!: string;

  @ApiProperty({ description: 'New status after the action' })
  newStatus!: string;
}

/**
 * Response DTO for invoice edit operations.
 */
export class InvoiceEditResponseDto {
  @ApiProperty({ description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ description: 'List of fields that were updated' })
  updatedFields!: string[];
}
