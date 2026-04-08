import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IFileStorage } from '../../domain/shared/file-storage';
import { Injectable, Inject } from '@nestjs/common';

/** Input for creating an export */
export interface CreateExportInput {
  /** Export format */
  readonly format: 'csv' | 'json';
  /** Optional batch ID filter */
  readonly batchId?: string;
  /** Optional schema ID filter */
  readonly schemaId?: string;
  /** Optional date range start (ISO string) */
  readonly dateFrom?: string;
  /** Optional date range end (ISO string) */
  readonly dateTo?: string;
  /** Optional status filter (e.g. 'approved') */
  readonly statusFilter?: string;
}

/** Output after export creation */
export interface CreateExportOutput {
  /** Export job ID */
  readonly exportId: string;
  /** Generated filename */
  readonly filename: string;
  /** Number of records exported */
  readonly recordCount: number;
  /** File size in bytes */
  readonly fileSizeBytes: number;
}

/** ID generator for exports */
function generateExportId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * CreateExportUseCase — exports approved invoices as CSV or JSON.
 *
 * Orchestrates:
 * 1. Query invoices with applied filters
 * 2. Serialize to chosen format
 * 3. Save file via IFileStorage
 * 4. Return export metadata
 */
@Injectable()
export class CreateExportUseCase {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IFileStorage') private readonly fileStorage: IFileStorage,
  ) {}

  /**
   * Execute the export flow.
   * @param input - Export parameters and filters
   * @returns Export metadata with file info
   */
  async execute(input: CreateExportInput): Promise<CreateExportOutput> {
    if (input.format !== 'csv' && input.format !== 'json') {
      throw new Error(`Invalid export format: "${input.format}". Must be 'csv' or 'json'`);
    }

    // Fetch invoices based on filters
    const invoices = await this.fetchFilteredInvoices(input);

    // Serialize to chosen format
    const exportId = generateExportId();
    const filename = `${exportId}.${input.format}`;
    let content: string;

    if (input.format === 'csv') {
      content = this.serializeToCsv(invoices);
    } else {
      content = this.serializeToJson(invoices);
    }

    const contentBuffer = Buffer.from(content, 'utf-8');

    // Save to storage
    await this.fileStorage.saveFile(`exports/${filename}`, contentBuffer);

    return {
      exportId,
      filename,
      recordCount: invoices.length,
      fileSizeBytes: contentBuffer.length,
    };
  }

  /**
   * Fetch invoices matching the export filters.
   * @param input - Filter parameters
   * @returns Filtered invoice data
   */
  private async fetchFilteredInvoices(input: CreateExportInput): Promise<ExportableInvoice[]> {
    const allInvoices: ExportableInvoice[] = [];

    if (input.batchId) {
      // Fetch by batch
      const invoices = await this.invoiceRepo.findByBatchId(input.batchId);
      for (const inv of invoices) {
        if (inv.status === 'approved') {
          allInvoices.push(this.toExportable(inv));
        }
      }
    } else {
      // Use findByFilters for non-batch exports
      const invoices = await this.invoiceRepo.findByFilters({
        status: input.statusFilter,
        schemaId: input.schemaId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      });
      for (const inv of invoices) {
        allInvoices.push(this.toExportable(inv));
      }
    }

    // Apply additional filters
    return allInvoices.filter(inv => {
      if (input.statusFilter && inv.status !== input.statusFilter) {
        return false;
      }
      if (input.schemaId && inv.schemaId !== input.schemaId) {
        return false;
      }
      if (input.dateFrom && inv.invoiceDate && inv.invoiceDate < input.dateFrom) {
        return false;
      }
      if (input.dateTo && inv.invoiceDate && inv.invoiceDate > input.dateTo) {
        return false;
      }
      return true;
    });
  }

  /**
   * Convert an invoice entity to exportable data.
   * @param invoice - Invoice entity
   * @returns Exportable invoice data
   */
  private toExportable(invoice: {
    id: string;
    invoiceNumber: string | null;
    invoiceSymbol: string | null;
    invoiceDate: string | null;
    invoiceType: string | null;
    sellerName: string | null;
    sellerTaxId: string | null;
    buyerName: string | null;
    buyerTaxId: string | null;
    subtotal: number | null;
    vatRate: number | null;
    vatAmount: number | null;
    total: number | null;
    schemaId: string | null;
    status: string;
  }): ExportableInvoice {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber ?? '',
      invoiceSymbol: invoice.invoiceSymbol ?? '',
      invoiceDate: invoice.invoiceDate ?? '',
      invoiceType: invoice.invoiceType ?? '',
      sellerName: invoice.sellerName ?? '',
      sellerTaxId: invoice.sellerTaxId ?? '',
      buyerName: invoice.buyerName ?? '',
      buyerTaxId: invoice.buyerTaxId ?? '',
      subtotal: invoice.subtotal ?? 0,
      vatRate: invoice.vatRate ?? 0,
      vatAmount: invoice.vatAmount ?? 0,
      total: invoice.total ?? 0,
      schemaId: invoice.schemaId ?? '',
      status: invoice.status,
    };
  }

  /**
   * Serialize invoices to CSV format.
   * @param invoices - Invoice data
   * @returns CSV string
   */
  private serializeToCsv(invoices: ExportableInvoice[]): string {
    const headers = [
      'id', 'invoiceNumber', 'invoiceSymbol', 'invoiceDate', 'invoiceType',
      'sellerName', 'sellerTaxId', 'buyerName', 'buyerTaxId',
      'subtotal', 'vatRate', 'vatAmount', 'total',
    ];
    const lines = [headers.join(',')];

    for (const inv of invoices) {
      const values = headers.map(h => {
        const val = inv[h as keyof ExportableInvoice];
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val ?? '');
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Serialize invoices to JSON format.
   * @param invoices - Invoice data
   * @returns JSON string
   */
  private serializeToJson(invoices: ExportableInvoice[]): string {
    return JSON.stringify(invoices, null, 2);
  }
}

/** Exportable invoice data shape */
interface ExportableInvoice {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly invoiceSymbol: string;
  readonly invoiceDate: string;
  readonly invoiceType: string;
  readonly sellerName: string;
  readonly sellerTaxId: string;
  readonly buyerName: string;
  readonly buyerTaxId: string;
  readonly subtotal: number;
  readonly vatRate: number;
  readonly vatAmount: number;
  readonly total: number;
  readonly schemaId: string;
  readonly status: string;
}
