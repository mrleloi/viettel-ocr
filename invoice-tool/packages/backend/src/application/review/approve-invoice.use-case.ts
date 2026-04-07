import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IBatchRepository } from '../../domain/batch/batch.repository';
import { Injectable, Inject } from '@nestjs/common';

/** Input for approving an invoice */
export interface ApproveInvoiceInput {
  /** Invoice ID to approve */
  readonly invoiceId: string;
  /** Reviewer identifier */
  readonly reviewedBy: string;
  /** Optional reviewer note */
  readonly reviewerNote?: string;
}

/** Output after approval */
export interface ApproveInvoiceOutput {
  /** Approved invoice ID */
  readonly invoiceId: string;
  /** Previous status before approval */
  readonly previousStatus: string;
  /** New status after approval */
  readonly newStatus: string;
}

/**
 * ApproveInvoiceUseCase — approves an invoice from needs_review status.
 *
 * Orchestrates:
 * 1. Find invoice by ID
 * 2. Call invoice.approve(reviewedBy)
 * 3. Update batch counters
 * 4. Persist changes
 */
@Injectable()
export class ApproveInvoiceUseCase {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IBatchRepository') private readonly batchRepo: IBatchRepository,
  ) {}

  /**
   * Execute the approval flow.
   * @param input - Approval parameters
   * @returns Approval result with status transition
   */
  async execute(input: ApproveInvoiceInput): Promise<ApproveInvoiceOutput> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${input.invoiceId}`);
    }

    const previousStatus = invoice.status;

    // Domain entity enforces status guard
    invoice.approve(input.reviewedBy);

    await this.invoiceRepo.save(invoice);

    // Update batch counters
    const batch = await this.batchRepo.findById(invoice.batchId);
    if (batch) {
      batch.recordFileResult(true);
      await this.batchRepo.save(batch);
    }

    return {
      invoiceId: invoice.id,
      previousStatus,
      newStatus: invoice.status,
    };
  }
}
