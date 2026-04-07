import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';

import { Injectable, Inject } from '@nestjs/common';

/** Input for editing an invoice's extracted data */
export interface EditInvoiceInput {
  /** Invoice ID to edit */
  readonly invoiceId: string;
  /** Key-value map of field changes */
  readonly changes: Record<string, unknown>;
}

/** Output after editing */
export interface EditInvoiceOutput {
  /** Edited invoice ID */
  readonly invoiceId: string;
  /** List of field names that were updated */
  readonly updatedFields: string[];
}

/** Fields on Invoice that can be edited during review */
const EDITABLE_FIELDS = new Set([
  'invoiceNumber',
  'invoiceSymbol',
  'invoiceDate',
  'invoiceType',
  'sellerName',
  'sellerTaxId',
  'buyerName',
  'buyerTaxId',
  'subtotal',
  'vatRate',
  'vatAmount',
  'total',
  'poNumber',
]);

/**
 * EditInvoiceUseCase — edits extracted data on an invoice in needs_review status.
 *
 * Does NOT change the invoice status. Only updates specific fields.
 *
 * Orchestrates:
 * 1. Find invoice by ID
 * 2. Verify invoice is in needs_review status
 * 3. Apply field changes
 * 4. Persist changes
 */
@Injectable()
export class EditInvoiceUseCase {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
  ) {}

  /**
   * Execute the edit flow.
   * @param input - Edit parameters including field changes
   * @returns Edit result with list of updated fields
   */
  async execute(input: EditInvoiceInput): Promise<EditInvoiceOutput> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${input.invoiceId}`);
    }

    if (invoice.status !== 'needs_review') {
      throw new Error(`Cannot edit invoice in "${invoice.status}" status — must be needs_review`);
    }

    const updatedFields: string[] = [];

    // Apply only valid field changes via setExtractedData partial update
    // We use the invoice's existing extracted data as baseline and overlay changes
    for (const field of Object.keys(input.changes)) {
      if (EDITABLE_FIELDS.has(field)) {
        updatedFields.push(field);
      }
    }

    if (updatedFields.length === 0) {
      return {
        invoiceId: invoice.id,
        updatedFields: [],
      };
    }

    // Build updated extracted data from current props + changes
    const currentProps = invoice.toProps();
    const updatedData = {
      schemaId: currentProps.schemaId ?? '',
      classificationMethod: currentProps.classificationMethod ?? 'manual' as const,
      classificationConfidence: currentProps.classificationConfidence ?? 0,
      invoiceNumber: currentProps.invoiceNumber,
      invoiceSymbol: currentProps.invoiceSymbol,
      invoiceDate: currentProps.invoiceDate,
      invoiceType: currentProps.invoiceType,
      sellerName: currentProps.sellerName,
      sellerTaxId: currentProps.sellerTaxId,
      buyerName: currentProps.buyerName,
      buyerTaxId: currentProps.buyerTaxId,
      subtotal: currentProps.subtotal,
      vatRate: currentProps.vatRate,
      vatAmount: currentProps.vatAmount,
      total: currentProps.total,
      poNumber: currentProps.poNumber,
      lineItems: currentProps.lineItems ?? [],
      ocrRawText: currentProps.ocrRawText,
      extractedRawJson: currentProps.extractedRawJson,
      fieldConfidences: currentProps.fieldConfidences,
    };

    // Overlay changes onto the baseline
    for (const field of updatedFields) {
      (updatedData as Record<string, unknown>)[field] = input.changes[field];
    }

    invoice.setExtractedData(updatedData);

    // Restore needs_review status since setExtractedData sets to 'extracted'
    invoice.markAsNeedsReview();

    await this.invoiceRepo.save(invoice);

    return {
      invoiceId: invoice.id,
      updatedFields,
    };
  }
}
