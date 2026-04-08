import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type {
  InvoiceProps,
  InvoiceStatus,
  ClassificationMethod,
  InvoiceType,
  LineItemProps,
} from '@invoice-tool/shared';

/** Props required to create a new Invoice */
export interface CreateInvoiceProps {
  readonly id?: string;
  readonly batchId: string;
  readonly originalFilename: string;
  readonly storagePath: string;
  readonly fileHash: string;
  readonly fileSizeBytes: number;
  readonly pageCount: number;
}

/** Props for setting extracted data on an invoice */
export interface ExtractedDataProps {
  readonly schemaId: string | null;
  readonly classificationMethod: ClassificationMethod;
  readonly classificationConfidence: number;
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
  readonly lineItems: ReadonlyArray<LineItemProps>;
  readonly ocrRawText: string | null;
  readonly extractedRawJson: string | null;
  readonly fieldConfidences: string | null;
}

/**
 * Invoice entity — core aggregate in the PROCESSING bounded context.
 * Tracks the full lifecycle of an invoice from upload through approval/rejection.
 */
export class Invoice {
  private props: InvoiceProps;

  private constructor(props: InvoiceProps) {
    this.props = props;
  }

  /**
   * Create a new Invoice (pending status).
   * @param input Required fields for a new invoice
   * @returns A new Invoice instance
   * @throws DomainError if required fields are missing or invalid
   */
  static create(input: CreateInvoiceProps): Invoice {
    if (!input.originalFilename) {
      throw new DomainError('Invoice filename is required');
    }
    if (!input.fileHash) {
      throw new DomainError('Invoice file hash is required');
    }
    if (!input.fileSizeBytes || input.fileSizeBytes <= 0) {
      throw new DomainError('Invoice file size must be positive');
    }
    if (!input.pageCount || input.pageCount <= 0) {
      throw new DomainError('Invoice page count must be positive');
    }

    const now = new Date();
    return new Invoice({
      id: input.id ?? generateId(),
      batchId: input.batchId,
      originalFilename: input.originalFilename,
      storagePath: input.storagePath,
      fileHash: input.fileHash,
      fileSizeBytes: input.fileSizeBytes,
      pageCount: input.pageCount,
      status: 'pending',
      schemaId: null,
      classificationMethod: null,
      classificationConfidence: null,
      invoiceNumber: null,
      invoiceSymbol: null,
      invoiceDate: null,
      invoiceType: null,
      sellerName: null,
      sellerTaxId: null,
      buyerName: null,
      buyerTaxId: null,
      subtotal: null,
      vatRate: null,
      vatAmount: null,
      total: null,
      poNumber: null,
      lineItems: [],
      overallConfidence: null,
      ocrRawText: null,
      extractedRawJson: null,
      validationErrors: null,
      fieldConfidences: null,
      duplicateOf: null,
      createdAt: now,
      updatedAt: now,
      processedAt: null,
      reviewedAt: null,
      reviewedBy: null,
    });
  }

  /**
   * Reconstitute an Invoice from stored data (skips validation).
   * @param props All invoice properties from persistence
   * @returns An Invoice instance
   */
  static reconstitute(props: InvoiceProps): Invoice {
    return new Invoice({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get batchId(): string { return this.props.batchId; }
  get originalFilename(): string { return this.props.originalFilename; }
  get storagePath(): string { return this.props.storagePath; }
  get fileHash(): string { return this.props.fileHash; }
  get fileSizeBytes(): number { return this.props.fileSizeBytes; }
  get pageCount(): number { return this.props.pageCount; }
  get status(): InvoiceStatus { return this.props.status; }
  get schemaId(): string | null { return this.props.schemaId; }
  get classificationMethod(): ClassificationMethod | null { return this.props.classificationMethod; }
  get classificationConfidence(): number | null { return this.props.classificationConfidence; }
  get invoiceNumber(): string | null { return this.props.invoiceNumber; }
  get invoiceSymbol(): string | null { return this.props.invoiceSymbol; }
  get invoiceDate(): string | null { return this.props.invoiceDate; }
  get invoiceType(): InvoiceType | null { return this.props.invoiceType; }
  get sellerName(): string | null { return this.props.sellerName; }
  get sellerTaxId(): string | null { return this.props.sellerTaxId; }
  get buyerName(): string | null { return this.props.buyerName; }
  get buyerTaxId(): string | null { return this.props.buyerTaxId; }
  get subtotal(): number | null { return this.props.subtotal; }
  get vatRate(): number | null { return this.props.vatRate; }
  get vatAmount(): number | null { return this.props.vatAmount; }
  get total(): number | null { return this.props.total; }
  get poNumber(): string | null { return this.props.poNumber; }
  get lineItems(): ReadonlyArray<LineItemProps> { return this.props.lineItems; }
  get overallConfidence(): number | null { return this.props.overallConfidence; }
  get ocrRawText(): string | null { return this.props.ocrRawText; }
  get extractedRawJson(): string | null { return this.props.extractedRawJson; }
  get validationErrors(): string | null { return this.props.validationErrors; }
  get fieldConfidences(): string | null { return this.props.fieldConfidences; }
  get duplicateOf(): string | null { return this.props.duplicateOf; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get processedAt(): Date | null { return this.props.processedAt; }
  get reviewedAt(): Date | null { return this.props.reviewedAt; }
  get reviewedBy(): string | null { return this.props.reviewedBy; }

  // --- State Transitions ---

  /**
   * Mark invoice as processing.
   * @throws DomainError if not in pending status
   */
  markAsProcessing(): void {
    if (this.props.status !== 'pending') {
      throw new DomainError(`Cannot start processing invoice in "${this.props.status}" status`);
    }
    this.props = { ...this.props, status: 'processing', updatedAt: new Date() };
  }

  /**
   * Set extracted data fields after OCR/AI processing.
   * Transitions to 'extracted' status.
   * @param data Extracted invoice data
   */
  setExtractedData(data: ExtractedDataProps): void {
    this.props = {
      ...this.props,
      status: 'extracted',
      schemaId: data.schemaId,
      classificationMethod: data.classificationMethod,
      classificationConfidence: data.classificationConfidence,
      invoiceNumber: data.invoiceNumber,
      invoiceSymbol: data.invoiceSymbol,
      invoiceDate: data.invoiceDate,
      invoiceType: data.invoiceType,
      sellerName: data.sellerName,
      sellerTaxId: data.sellerTaxId,
      buyerName: data.buyerName,
      buyerTaxId: data.buyerTaxId,
      subtotal: data.subtotal,
      vatRate: data.vatRate,
      vatAmount: data.vatAmount,
      total: data.total,
      poNumber: data.poNumber,
      lineItems: [...data.lineItems],
      ocrRawText: data.ocrRawText,
      extractedRawJson: data.extractedRawJson,
      fieldConfidences: data.fieldConfidences,
      processedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Mark as duplicate of another invoice.
   * @param originalInvoiceId ID of the original invoice
   */
  markAsDuplicate(originalInvoiceId: string): void {
    this.props = {
      ...this.props,
      status: 'duplicate',
      duplicateOf: originalInvoiceId,
      updatedAt: new Date(),
    };
  }

  /**
   * Mark invoice as needing human review.
   */
  markAsNeedsReview(): void {
    this.props = { ...this.props, status: 'needs_review', updatedAt: new Date() };
  }

  /**
   * Approve the invoice.
   * @param reviewedBy Identifier of the reviewer
   * @throws DomainError if not in needs_review status
   */
  approve(reviewedBy: string): void {
    if (this.props.status !== 'needs_review') {
      throw new DomainError(`Cannot approve invoice in "${this.props.status}" status`);
    }
    const now = new Date();
    this.props = {
      ...this.props,
      status: 'approved',
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Reject the invoice.
   * @param reviewedBy Identifier of the reviewer
   * @throws DomainError if not in needs_review status
   */
  reject(reviewedBy: string): void {
    if (this.props.status !== 'needs_review') {
      throw new DomainError(`Cannot reject invoice in "${this.props.status}" status`);
    }
    const now = new Date();
    this.props = {
      ...this.props,
      status: 'rejected',
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Set the overall confidence score.
   * @param confidence Score between 0.0 and 1.0
   * @throws DomainError if out of range
   */
  setOverallConfidence(confidence: number): void {
    if (confidence < 0 || confidence > 1) {
      throw new DomainError(`Confidence must be between 0 and 1, got: ${confidence}`);
    }
    this.props = { ...this.props, overallConfidence: confidence, updatedAt: new Date() };
  }

  /**
   * Set validation errors JSON string.
   * @param errors Serialized validation errors
   */
  setValidationErrors(errors: string): void {
    this.props = { ...this.props, validationErrors: errors, updatedAt: new Date() };
  }

  /**
   * Mark invoice as validated.
   */
  markAsValidated(): void {
    this.props = { ...this.props, status: 'validated', updatedAt: new Date() };
  }

  /**
   * Mark invoice as mapped (line items mapped to Viettel products).
   */
  markAsMapped(): void {
    this.props = { ...this.props, status: 'mapped', updatedAt: new Date() };
  }

  /**
   * Mark invoice as errored.
   */
  markAsError(): void {
    this.props = { ...this.props, status: 'error', updatedAt: new Date() };
  }

  /**
   * Resume an invoice for reprocessing.
   * Resets to pending status and wipes all extracted data.
   * Only allowed from terminal states: approved, rejected, error, duplicate.
   * @throws DomainError if not in a reprocessable status
   */
  resumeForReprocess(): void {
    const reprocessableStatuses: InvoiceStatus[] = ['approved', 'rejected', 'error', 'duplicate'];
    if (!reprocessableStatuses.includes(this.props.status)) {
      throw new DomainError(`Cannot reprocess invoice in "${this.props.status}" status`);
    }
    this.props = {
      ...this.props,
      status: 'pending',
      schemaId: null,
      classificationMethod: null,
      classificationConfidence: null,
      invoiceNumber: null,
      invoiceSymbol: null,
      invoiceDate: null,
      invoiceType: null,
      sellerName: null,
      sellerTaxId: null,
      buyerName: null,
      buyerTaxId: null,
      subtotal: null,
      vatRate: null,
      vatAmount: null,
      total: null,
      poNumber: null,
      lineItems: [],
      overallConfidence: null,
      ocrRawText: null,
      extractedRawJson: null,
      validationErrors: null,
      fieldConfidences: null,
      duplicateOf: null,
      processedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: new Date(),
    };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns InvoiceProps
   */
  toProps(): InvoiceProps {
    return { ...this.props };
  }
}
