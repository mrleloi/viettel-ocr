import type { ProcessingTrace } from './processing-trace.entity';

/**
 * Repository interface for ProcessingTrace persistence.
 * Implementations live in the infrastructure layer.
 */
export interface IProcessingTraceRepository {
  /**
   * Persist a processing trace (insert or update).
   * @param trace - ProcessingTrace entity to save
   */
  save(trace: ProcessingTrace): Promise<void>;

  /**
   * Find all processing traces for an invoice, ordered by createdAt ASC.
   * @param invoiceId - Invoice ID to query traces for
   * @returns Array of traces in chronological order
   */
  findByInvoiceId(invoiceId: string): Promise<ProcessingTrace[]>;
}
