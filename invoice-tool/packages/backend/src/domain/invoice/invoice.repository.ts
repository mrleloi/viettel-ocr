import type { InvoiceStatus } from '@invoice-tool/shared';
import type { Invoice } from './invoice.entity';

/**
 * Repository interface for Invoice aggregate persistence.
 * Implementations live in infrastructure layer.
 */
export interface IInvoiceRepository {
  /**
   * Find an invoice by its unique ID.
   * @param id Invoice ID
   * @returns The Invoice if found, null otherwise
   */
  findById(id: string): Promise<Invoice | null>;

  /**
   * Find all invoices belonging to a batch.
   * @param batchId Batch ID
   * @returns Array of invoices in the batch
   */
  findByBatchId(batchId: string): Promise<Invoice[]>;

  /**
   * Find invoices by status, ordered by most recent first.
   * @param status Status to filter by, or undefined to return all
   * @param limit Maximum number of results
   * @returns Array of matching invoices
   */
  findRecent(status: InvoiceStatus | undefined, limit: number): Promise<Invoice[]>;

  /**
   * Find an invoice by its file hash (exact duplicate detection).
   * @param fileHash SHA-256 hash of the file
   * @returns The Invoice if found, null otherwise
   */
  findByFileHash(fileHash: string): Promise<Invoice | null>;

  /**
   * Find a logical duplicate: same symbol + number + seller tax ID.
   * @param symbol Invoice symbol
   * @param number Invoice number
   * @param sellerTaxId Seller's MST
   * @returns The Invoice if a duplicate exists, null otherwise
   */
  findDuplicate(symbol: string, number: string, sellerTaxId: string): Promise<Invoice | null>;

  /**
   * Persist an invoice (insert or update).
   * @param invoice Invoice entity to save
   */
  save(invoice: Invoice): Promise<void>;

  /**
   * Update only the status field (optimized for pipeline transitions).
   * @param id Invoice ID
   * @param status New status value
   */
  updateStatus(id: string, status: InvoiceStatus): Promise<void>;

  /**
   * Find invoices matching a set of optional filters.
   * - dateFrom/dateTo (YYYY-MM-DD): inclusive range on the invoice's printed date.
   * - processedFrom/processedTo (YYYY-MM-DD): inclusive range on the system's processing date.
   * Both ranges may be combined; they are ANDed.
   */
  findByFilters(filters: {
    status?: string;
    schemaId?: string;
    dateFrom?: string;
    dateTo?: string;
    processedFrom?: string;
    processedTo?: string;
  }): Promise<Invoice[]>;
}
