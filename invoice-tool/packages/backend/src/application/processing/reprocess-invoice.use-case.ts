import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IJobQueue } from '../../domain/shared/job-queue';
import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { CreateNotificationUseCase } from '../notification/create-notification.use-case';

/** Input for the reprocess invoice use case */
export interface ReprocessInvoiceInput {
  /** Invoice ID to reprocess */
  readonly invoiceId: string;
}

/** Output of the reprocess invoice use case */
export interface ReprocessInvoiceOutput {
  /** Invoice ID */
  readonly invoiceId: string;
  /** Status before reprocessing */
  readonly previousStatus: string;
  /** New status after reprocessing (should be 'pending') */
  readonly newStatus: string;
}

/**
 * ReprocessInvoiceUseCase — re-runs the processing pipeline on an existing invoice.
 *
 * Resets the invoice to 'pending' status, wipes extracted data, and enqueues
 * it for a fresh pipeline run. Only allowed from terminal states:
 * approved, rejected, error, duplicate.
 */
@Injectable()
export class ReprocessInvoiceUseCase {
  private readonly logger = new Logger(ReprocessInvoiceUseCase.name);

  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IJobQueue') private readonly jobQueue: IJobQueue,
    @Optional() private readonly createNotification?: CreateNotificationUseCase,
  ) {}

  /**
   * Execute the reprocess flow.
   * @param input - Contains the invoice ID to reprocess
   * @returns Reprocess result with previous and new status
   * @throws Error if invoice not found
   * @throws DomainError if invoice is not in a reprocessable status
   */
  async execute(input: ReprocessInvoiceInput): Promise<ReprocessInvoiceOutput> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${input.invoiceId}`);
    }

    const previousStatus = invoice.status;

    // Domain method validates allowed transitions and wipes data
    invoice.resumeForReprocess();

    await this.invoiceRepo.save(invoice);
    await this.jobQueue.enqueue(invoice.id);

    this.logger.log(`Invoice ${invoice.id} reprocessing: ${previousStatus} → pending`);

    // Emit notification (non-critical)
    try {
      await this.createNotification?.execute({
        category: 'info',
        title: 'Xử lý lại hóa đơn',
        message: `Hóa đơn "${invoice.originalFilename}" đang được xử lý lại.`,
        relatedEntityType: 'invoice',
        relatedEntityId: invoice.id,
      });
    } catch (err) {
      this.logger.warn('Failed to create reprocess notification', err);
    }

    return {
      invoiceId: invoice.id,
      previousStatus,
      newStatus: invoice.status,
    };
  }
}
