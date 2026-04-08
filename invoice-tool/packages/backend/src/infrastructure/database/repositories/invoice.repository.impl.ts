import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { invoices } from '../schema';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import { Invoice } from '../../../domain/invoice/invoice.entity';
import type {
  InvoiceProps,
  InvoiceStatus,
  ClassificationMethod,
  InvoiceType,
  LineItemProps,
} from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of IInvoiceRepository.
 */
@Injectable()
export class InvoiceRepositoryImpl implements IInvoiceRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find an invoice by its unique ID.
   * @param id Invoice ID
   * @returns The Invoice if found, null otherwise
   */
  async findById(id: string): Promise<Invoice | null> {
    const row = await this.db.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!row) return null;
    return Invoice.reconstitute(this.toDomain(row));
  }

  /**
   * Find all invoices belonging to a batch.
   * @param batchId Batch ID
   * @returns Array of invoices in the batch
   */
  async findByBatchId(batchId: string): Promise<Invoice[]> {
    const rows = await this.db.select().from(invoices)
      .where(eq(invoices.batchId, batchId))
      .all();
    return rows.map((row) => Invoice.reconstitute(this.toDomain(row)));
  }

  /**
   * Find recent invoices, optionally filtered by status.
   * @param status Status filter (undefined returns all)
   * @param limit Max number of rows to return
   * @returns Recent invoices, newest first
   */
  async findRecent(status: InvoiceStatus | undefined, limit: number): Promise<Invoice[]> {
    const baseQuery = this.db.select().from(invoices);
    const filtered = status
      ? baseQuery.where(eq(invoices.status, status))
      : baseQuery;
    const rows = await filtered.orderBy(desc(invoices.createdAt)).limit(limit).all();
    return rows.map((row) => Invoice.reconstitute(this.toDomain(row)));
  }

  /**
   * Find an invoice by its file hash (exact duplicate detection).
   * @param fileHash SHA-256 hash of the file
   * @returns The Invoice if found, null otherwise
   */
  async findByFileHash(fileHash: string): Promise<Invoice | null> {
    const row = await this.db.select().from(invoices)
      .where(eq(invoices.fileHash, fileHash))
      .get();
    if (!row) return null;
    return Invoice.reconstitute(this.toDomain(row));
  }

  /**
   * Find a logical duplicate: same symbol + number + seller tax ID.
   * @param symbol Invoice symbol
   * @param number Invoice number
   * @param sellerTaxId Seller's MST
   * @returns The Invoice if a duplicate exists, null otherwise
   */
  async findDuplicate(symbol: string, number: string, sellerTaxId: string): Promise<Invoice | null> {
    const row = await this.db.select().from(invoices)
      .where(and(
        eq(invoices.invoiceSymbol, symbol),
        eq(invoices.invoiceNumber, number),
        eq(invoices.sellerTaxId, sellerTaxId),
      ))
      .get();
    if (!row) return null;
    return Invoice.reconstitute(this.toDomain(row));
  }

  /**
   * Persist an invoice (insert or update).
   * @param invoice Invoice entity to save
   */
  async save(invoice: Invoice): Promise<void> {
    const data = this.toPersistence(invoice);
    await this.db.insert(invoices).values(data)
      .onConflictDoUpdate({ target: invoices.id, set: data });
  }

  /**
   * Update only the status field (optimized for pipeline transitions).
   * @param id Invoice ID
   * @param status New status value
   */
  async updateStatus(id: string, status: InvoiceStatus): Promise<void> {
    await this.db.update(invoices)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, id));
  }

  /**
   * Find invoices matching a set of optional filters.
   * @param filters Optional status, schemaId, dateFrom, dateTo filters
   * @returns Matching invoices (all if no filters)
   */
  async findByFilters(filters: {
    status?: string;
    schemaId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Invoice[]> {
    let query = this.db.select().from(invoices);
    const conditions = [];
    if (filters.status) conditions.push(eq(invoices.status, filters.status));
    if (filters.schemaId) conditions.push(eq(invoices.schemaId, filters.schemaId));
    if (filters.dateFrom) conditions.push(gte(invoices.createdAt, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(invoices.createdAt, filters.dateTo));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const rows = await query.all();
    return rows.map((row) => Invoice.reconstitute(this.toDomain(row)));
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns InvoiceProps for reconstitution
   */
  private toDomain(row: typeof invoices.$inferSelect): InvoiceProps {
    return {
      id: row.id,
      batchId: row.batchId,
      originalFilename: row.originalFilename,
      storagePath: row.storagePath,
      fileHash: row.fileHash,
      fileSizeBytes: row.fileSizeBytes,
      pageCount: row.pageCount,
      status: row.status as InvoiceStatus,
      schemaId: row.schemaId ?? null,
      classificationMethod: (row.classificationMethod as ClassificationMethod) ?? null,
      classificationConfidence: row.classificationConfidence ?? null,
      invoiceNumber: row.invoiceNumber ?? null,
      invoiceSymbol: row.invoiceSymbol ?? null,
      invoiceDate: row.invoiceDate ?? null,
      invoiceType: (row.invoiceType as InvoiceType) ?? null,
      sellerName: row.sellerName ?? null,
      sellerTaxId: row.sellerTaxId ?? null,
      buyerName: row.buyerName ?? null,
      buyerTaxId: row.buyerTaxId ?? null,
      subtotal: row.subtotal ?? null,
      vatRate: row.vatRate ?? null,
      vatAmount: row.vatAmount ?? null,
      total: row.total ?? null,
      poNumber: row.poNumber ?? null,
      lineItems: row.lineItems ? JSON.parse(row.lineItems) as LineItemProps[] : [],
      overallConfidence: row.overallConfidence ?? null,
      ocrRawText: row.ocrRawText ?? null,
      extractedRawJson: row.extractedRawJson ?? null,
      validationErrors: row.validationErrors ?? null,
      fieldConfidences: row.fieldConfidences ?? null,
      duplicateOf: row.duplicateOf ?? null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      processedAt: row.processedAt ? new Date(row.processedAt) : null,
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
      reviewedBy: row.reviewedBy ?? null,
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity Invoice entity
   * @returns Insert/update values
   */
  private toPersistence(entity: Invoice): typeof invoices.$inferInsert {
    return {
      id: entity.id,
      batchId: entity.batchId,
      originalFilename: entity.originalFilename,
      storagePath: entity.storagePath,
      fileHash: entity.fileHash,
      fileSizeBytes: entity.fileSizeBytes,
      pageCount: entity.pageCount,
      status: entity.status,
      schemaId: entity.schemaId,
      classificationMethod: entity.classificationMethod,
      classificationConfidence: entity.classificationConfidence,
      invoiceNumber: entity.invoiceNumber,
      invoiceSymbol: entity.invoiceSymbol,
      invoiceDate: entity.invoiceDate,
      invoiceType: entity.invoiceType,
      sellerName: entity.sellerName,
      sellerTaxId: entity.sellerTaxId,
      buyerName: entity.buyerName,
      buyerTaxId: entity.buyerTaxId,
      subtotal: entity.subtotal,
      vatRate: entity.vatRate,
      vatAmount: entity.vatAmount,
      total: entity.total,
      poNumber: entity.poNumber,
      lineItems: entity.lineItems.length > 0 ? JSON.stringify(entity.lineItems) : null,
      overallConfidence: entity.overallConfidence,
      ocrRawText: entity.ocrRawText,
      extractedRawJson: entity.extractedRawJson,
      validationErrors: entity.validationErrors,
      fieldConfidences: entity.fieldConfidences,
      duplicateOf: entity.duplicateOf,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      processedAt: entity.processedAt?.toISOString() ?? null,
      reviewedAt: entity.reviewedAt?.toISOString() ?? null,
      reviewedBy: entity.reviewedBy,
    };
  }
}
