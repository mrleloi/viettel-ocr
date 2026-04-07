import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IBatchRepository } from '../../domain/batch/batch.repository';
import { Injectable, Inject } from '@nestjs/common';

/** Input for rejecting an invoice */
export interface RejectInvoiceInput {
  /** Invoice ID to reject */
  readonly invoiceId: string;
  /** Reviewer identifier */
  readonly reviewedBy: string;
  /** Reason for rejection (required) */
  readonly reason: string;
}

/** Output after rejection */
export interface RejectInvoiceOutput {
  /** Rejected invoice ID */
  readonly invoiceId: string;
  /** Previous status before rejection */
  readonly previousStatus: string;
  /** New status after rejection */
  readonly newStatus: string;
}

/**
 * RejectInvoiceUseCase — rejects an invoice from needs_review status.
 *
 * Orchestrates:
 * 1. Validate reason is non-empty
 * 2. Find invoice by ID
 * 3. Call invoice.reject(reviewedBy)
 * 4. Update batch counters (failed)
 * 5. Persist changes
 */
@Injectable()
export class RejectInvoiceUseCase {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IBatchRepository') private readonly batchRepo: IBatchRepository,
  ) {}

  /**
   * Execute the rejection flow.
   * @param input - Rejection parameters including reason
   * @returns Rejection result with status transition
   */
  async execute(input: RejectInvoiceInput): Promise<RejectInvoiceOutput> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${input.invoiceId}`);
    }

    const previousStatus = invoice.status;

    // Domain entity enforces status guard
    invoice.reject(input.reviewedBy);

    await this.invoiceRepo.save(invoice);

    // Update batch counters (rejection = error file)
    const batch = await this.batchRepo.findById(invoice.batchId);
    if (batch) {
      batch.recordFileResult(false);
      await this.batchRepo.save(batch);
    }

    return {
      invoiceId: invoice.id,
      previousStatus,
      newStatus: invoice.status,
    };
  }
}
