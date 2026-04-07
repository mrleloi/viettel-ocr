/**
 * Invoice domain types shared between frontend and backend.
 */

/** Invoice processing status */
export type InvoiceStatus =
  | 'pending'
  | 'processing'
  | 'extracted'
  | 'validated'
  | 'mapped'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'error'
  | 'duplicate';

/** How the invoice was classified to a schema */
export type ClassificationMethod =
  | 'frontend_hint'
  | 'fingerprint'
  | 'llm'
  | 'manual';

/** Invoice type */
export type InvoiceType = 'original' | 'adjustment' | 'replacement';

/** Extracted line item from invoice */
export interface LineItemProps {
  readonly name: string;
  readonly unit: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly amount: number;
  readonly vatRate: number | null;
  readonly vatAmount: number | null;
  readonly totalWithVat: number | null;
}

/** Core invoice properties */
export interface InvoiceProps {
  readonly id: string;
  readonly batchId: string;
  readonly originalFilename: string;
  readonly storagePath: string;
  readonly fileHash: string;
  readonly fileSizeBytes: number;
  readonly pageCount: number;
  readonly status: InvoiceStatus;
  readonly schemaId: string | null;
  readonly classificationMethod: ClassificationMethod | null;
  readonly classificationConfidence: number | null;

  // Extracted header fields
  readonly invoiceNumber: string | null;
  readonly invoiceSymbol: string | null;
  readonly invoiceDate: string | null;
  readonly invoiceType: InvoiceType | null;
  readonly sellerName: string | null;
  readonly sellerTaxId: string | null;
  readonly buyerName: string | null;
  readonly buyerTaxId: string | null;
  readonly subtotal: number | null;
  readonly vatRate: number | null;
  readonly vatAmount: number | null;
  readonly total: number | null;
  readonly poNumber: string | null;

  // Extracted line items
  readonly lineItems: ReadonlyArray<LineItemProps>;

  // Processing metadata
  readonly overallConfidence: number | null;
  readonly ocrRawText: string | null;
  readonly extractedRawJson: string | null;
  readonly validationErrors: string | null;
  readonly fieldConfidences: string | null;

  // Duplicate tracking
  readonly duplicateOf: string | null;

  // Timestamps
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly processedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: string | null;
}
