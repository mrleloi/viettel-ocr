import ExcelJS from 'exceljs';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import type { IFileStorage } from '../../domain/shared/file-storage';
import type { Invoice } from '../../domain/invoice/invoice.entity';
import type { LineItemProps } from '@invoice-tool/shared';
import { Injectable, Inject, Optional } from '@nestjs/common';

/** Supported export formats */
export type ExportFormat = 'csv' | 'json' | 'xlsx';

/** Input for creating an export */
export interface CreateExportInput {
  readonly format: ExportFormat;
  readonly batchId?: string;
  readonly schemaId?: string;
  /** Invoice-date range (YYYY-MM-DD, inclusive) — date printed on the invoice. */
  readonly dateFrom?: string;
  readonly dateTo?: string;
  /** Processed-date range (YYYY-MM-DD, inclusive) — system date when the file was processed. */
  readonly processedFrom?: string;
  readonly processedTo?: string;
  readonly statusFilter?: string;
}

/** Output after export creation */
export interface CreateExportOutput {
  readonly exportId: string;
  readonly filename: string;
  readonly recordCount: number;
  readonly fileSizeBytes: number;
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
  /** ISO 8601 timestamp (UTC) — when processing finished, or empty if not yet processed. */
  readonly processedAt: string;
  readonly lineItems: ReadonlyArray<LineItemProps>;
}

/**
 * Slugify a Vietnamese string: remove diacritics, lowercase, keep alphanumeric + hyphens.
 * e.g. "CÔNG TY TNHH APPLE VIỆT NAM" → "cong-ty-tnhh-apple-viet-nam"
 */
function slugify(input: string, maxLen = 40): string {
  const s = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, maxLen).replace(/-+$/, '');
}

/** Pad number to two digits. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Format current local time as YYYY-MM-DD_HHmmss. */
function formatTimestamp(d: Date = new Date()): string {
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return `${date}_${time}`;
}

const VALID_FORMATS: ReadonlyArray<ExportFormat> = ['csv', 'json', 'xlsx'];

/**
 * CreateExportUseCase — exports approved invoices as CSV, JSON, or XLSX.
 *
 * XLSX output is a styled workbook with two sheets:
 *   - "Hóa đơn": one row per invoice (header + summary fields)
 *   - "Chi tiết hàng hóa": one row per line item, referencing its invoice
 */
@Injectable()
export class CreateExportUseCase {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IFileStorage') private readonly fileStorage: IFileStorage,
    @Optional() @Inject('ISchemaRepository') private readonly schemaRepo?: ISchemaRepository,
  ) {}

  /**
   * Execute the export flow.
   * @param input - Export parameters and filters
   * @returns Export metadata with file info
   */
  async execute(input: CreateExportInput): Promise<CreateExportOutput> {
    if (!VALID_FORMATS.includes(input.format)) {
      throw new Error(
        `Invalid export format: "${input.format}". Must be one of ${VALID_FORMATS.join(', ')}`,
      );
    }

    const invoices = await this.fetchFilteredInvoices(input);

    const exportId = await this.generateExportId(input, invoices.length);
    const filename = `${exportId}.${input.format}`;
    let contentBuffer: Buffer;

    if (input.format === 'csv') {
      contentBuffer = Buffer.from(this.serializeToCsv(invoices), 'utf-8');
    } else if (input.format === 'json') {
      contentBuffer = Buffer.from(this.serializeToJson(invoices), 'utf-8');
    } else {
      contentBuffer = await this.serializeToXlsx(invoices);
    }

    await this.fileStorage.saveFile(`exports/${filename}`, contentBuffer);

    return {
      exportId,
      filename,
      recordCount: invoices.length,
      fileSizeBytes: contentBuffer.length,
    };
  }

  /**
   * Generate a structured, human-readable export ID.
   * Format: `hoadon_{scope}_{YYYY-MM-DD}_{HHmmss}_{count}rows_{rand4}`
   * - scope: NCC slug if schema filter, 'batch-{short}' if batch filter, 'all' otherwise
   * - Randoms prevent collisions when two exports happen in the same second
   */
  private async generateExportId(input: CreateExportInput, recordCount: number): Promise<string> {
    const parts: string[] = ['hoadon'];

    // Scope segment
    if (input.schemaId && this.schemaRepo) {
      const schema = await this.schemaRepo.findById(input.schemaId);
      if (schema) {
        const slug = slugify(schema.nccName ?? schema.name);
        if (slug) parts.push(slug);
      } else {
        parts.push('sch-' + input.schemaId.slice(0, 8));
      }
    } else if (input.batchId) {
      parts.push('batch-' + input.batchId.slice(0, 8));
    } else {
      parts.push('all');
    }

    // Status segment (only if filtering by status and no batch — batch exports are always approved)
    if (input.statusFilter && !input.batchId) {
      parts.push(input.statusFilter);
    }

    // Timestamp + record count + random suffix for uniqueness
    parts.push(formatTimestamp());
    parts.push(`${recordCount}rows`);
    parts.push(Math.random().toString(36).slice(2, 6));

    return parts.join('_');
  }

  /**
   * Fetch invoices matching the export filters.
   */
  private async fetchFilteredInvoices(input: CreateExportInput): Promise<ExportableInvoice[]> {
    const allInvoices: ExportableInvoice[] = [];

    if (input.batchId) {
      const invoices = await this.invoiceRepo.findByBatchId(input.batchId);
      for (const inv of invoices) {
        if (inv.status === 'approved') {
          allInvoices.push(this.toExportable(inv));
        }
      }
    } else {
      const invoices = await this.invoiceRepo.findByFilters({
        status: input.statusFilter,
        schemaId: input.schemaId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        processedFrom: input.processedFrom,
        processedTo: input.processedTo,
      });
      for (const inv of invoices) {
        allInvoices.push(this.toExportable(inv));
      }
    }

    return allInvoices.filter(inv => {
      if (input.statusFilter && inv.status !== input.statusFilter) return false;
      if (input.schemaId && inv.schemaId !== input.schemaId) return false;
      if (input.dateFrom && inv.invoiceDate && inv.invoiceDate < input.dateFrom) return false;
      if (input.dateTo && inv.invoiceDate && inv.invoiceDate > input.dateTo) return false;
      if (input.processedFrom && (!inv.processedAt || inv.processedAt.slice(0, 10) < input.processedFrom)) return false;
      if (input.processedTo && (!inv.processedAt || inv.processedAt.slice(0, 10) > input.processedTo)) return false;
      return true;
    });
  }

  /**
   * Convert an invoice entity to exportable data (includes line items).
   */
  private toExportable(invoice: Invoice): ExportableInvoice {
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
      processedAt: invoice.processedAt ? invoice.processedAt.toISOString() : '',
      lineItems: invoice.lineItems ?? [],
    };
  }

  /**
   * Serialize invoices to CSV format (ASCII-friendly keys, UTF-8 BOM for Excel).
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
        if (typeof val === 'number') {
          return String(val);
        }
        return '';
      });
      lines.push(values.join(','));
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Serialize invoices to JSON format.
   */
  private serializeToJson(invoices: ExportableInvoice[]): string {
    return JSON.stringify(invoices, null, 2);
  }

  /**
   * Serialize invoices to a styled XLSX workbook.
   *
   * Sheet 1 "Tổng hợp" — flat view: invoice fields + line item fields on one row.
   * Sheet 2 "Hóa đơn" — invoice header rows (one per invoice).
   * Sheet 3 "Chi tiết hàng hóa" — line item rows across all invoices.
   */
  private async serializeToXlsx(invoices: ExportableInvoice[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Viettel Invoice Tool';
    workbook.created = new Date();

    this.buildCombinedSheet(workbook, invoices);
    this.buildInvoiceSheet(workbook, invoices);
    this.buildLineItemSheet(workbook, invoices);

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  /**
   * Build the combined flat sheet: invoice fields + line item fields on every row.
   * Invoices without line items emit a single row with blank line item fields.
   */
  private buildCombinedSheet(workbook: ExcelJS.Workbook, invoices: ExportableInvoice[]): void {
    const sheet = workbook.addWorksheet('Tổng hợp', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    });

    const CURRENCY = '#,##0 "₫"';
    const PERCENT = '0.00"%"';
    const DATE = 'yyyy-mm-dd';
    const NUMBER = '#,##0.##';

    sheet.columns = [
      // Invoice fields
      { header: 'ID hóa đơn', key: 'id', width: 28 },
      { header: 'Số hóa đơn', key: 'invoiceNumber', width: 18 },
      { header: 'Ký hiệu', key: 'invoiceSymbol', width: 14 },
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 14, style: { numFmt: DATE } },
      { header: 'Loại', key: 'invoiceType', width: 12 },
      { header: 'Người bán', key: 'sellerName', width: 32 },
      { header: 'MST người bán', key: 'sellerTaxId', width: 16 },
      { header: 'Người mua', key: 'buyerName', width: 32 },
      { header: 'MST người mua', key: 'buyerTaxId', width: 16 },
      { header: 'Tiền hàng (HĐ)', key: 'subtotal', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Thuế suất (HĐ)', key: 'invoiceVatRate', width: 12, style: { numFmt: PERCENT } },
      { header: 'Tiền thuế (HĐ)', key: 'vatAmount', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Tổng cộng (HĐ)', key: 'total', width: 18, style: { numFmt: CURRENCY } },
      { header: 'Trạng thái', key: 'status', width: 14 },
      // Line item fields
      { header: 'STT dòng', key: 'lineIndex', width: 8 },
      { header: 'Mã sản phẩm', key: 'itemProductCode', width: 16 },
      { header: 'Tên hàng hóa / dịch vụ', key: 'itemName', width: 40 },
      { header: 'Đơn vị', key: 'itemUnit', width: 10 },
      { header: 'Số lượng', key: 'itemQuantity', width: 10, style: { numFmt: NUMBER } },
      { header: 'Đơn giá', key: 'itemUnitPrice', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Thành tiền', key: 'itemAmount', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Thuế suất (dòng)', key: 'itemVatRate', width: 12, style: { numFmt: PERCENT } },
      { header: 'Tiền thuế (dòng)', key: 'itemVatAmount', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Tổng dòng (có VAT)', key: 'itemTotalWithVat', width: 18, style: { numFmt: CURRENCY } },
    ];

    for (const inv of invoices) {
      const invoiceFields = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceSymbol: inv.invoiceSymbol,
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : null,
        invoiceType: inv.invoiceType,
        sellerName: inv.sellerName,
        sellerTaxId: inv.sellerTaxId,
        buyerName: inv.buyerName,
        buyerTaxId: inv.buyerTaxId,
        subtotal: inv.subtotal,
        invoiceVatRate: inv.vatRate,
        vatAmount: inv.vatAmount,
        total: inv.total,
        status: inv.status,
      };

      if (inv.lineItems.length === 0) {
        sheet.addRow(invoiceFields);
        continue;
      }

      inv.lineItems.forEach((item, idx) => {
        sheet.addRow({
          ...invoiceFields,
          lineIndex: idx + 1,
          itemProductCode: item.productCode ?? '',
          itemName: item.name,
          itemUnit: item.unit ?? '',
          itemQuantity: item.quantity,
          itemUnitPrice: item.unitPrice,
          itemAmount: item.amount,
          itemVatRate: item.vatRate,
          itemVatAmount: item.vatAmount,
          itemTotalWithVat: item.totalWithVat,
        });
      });
    }

    this.styleHeaderRow(sheet.getRow(1));
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  /** Build the invoice summary sheet. */
  private buildInvoiceSheet(workbook: ExcelJS.Workbook, invoices: ExportableInvoice[]): void {
    const sheet = workbook.addWorksheet('Hóa đơn', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const CURRENCY = '#,##0 "₫"';
    const PERCENT = '0.00"%"';
    const DATE = 'yyyy-mm-dd';

    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Số hóa đơn', key: 'invoiceNumber', width: 18 },
      { header: 'Ký hiệu', key: 'invoiceSymbol', width: 14 },
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 14, style: { numFmt: DATE } },
      { header: 'Loại', key: 'invoiceType', width: 12 },
      { header: 'Người bán', key: 'sellerName', width: 32 },
      { header: 'MST người bán', key: 'sellerTaxId', width: 16 },
      { header: 'Người mua', key: 'buyerName', width: 32 },
      { header: 'MST người mua', key: 'buyerTaxId', width: 16 },
      { header: 'Tiền hàng', key: 'subtotal', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Thuế suất', key: 'vatRate', width: 11, style: { numFmt: PERCENT } },
      { header: 'Tiền thuế', key: 'vatAmount', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Tổng cộng', key: 'total', width: 18, style: { numFmt: CURRENCY } },
      { header: 'Số dòng hàng', key: 'lineCount', width: 12 },
      { header: 'Schema', key: 'schemaId', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 14 },
    ];

    for (const inv of invoices) {
      sheet.addRow({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceSymbol: inv.invoiceSymbol,
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : null,
        invoiceType: inv.invoiceType,
        sellerName: inv.sellerName,
        sellerTaxId: inv.sellerTaxId,
        buyerName: inv.buyerName,
        buyerTaxId: inv.buyerTaxId,
        subtotal: inv.subtotal,
        vatRate: inv.vatRate,
        vatAmount: inv.vatAmount,
        total: inv.total,
        lineCount: inv.lineItems.length,
        schemaId: inv.schemaId,
        status: inv.status,
      });
    }

    this.styleHeaderRow(sheet.getRow(1));
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  /** Build the line items detail sheet. */
  private buildLineItemSheet(workbook: ExcelJS.Workbook, invoices: ExportableInvoice[]): void {
    const sheet = workbook.addWorksheet('Chi tiết hàng hóa', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const CURRENCY = '#,##0 "₫"';
    const PERCENT = '0.00"%"';
    const NUMBER = '#,##0.##';

    sheet.columns = [
      { header: 'ID hóa đơn', key: 'invoiceId', width: 28 },
      { header: 'Số hóa đơn', key: 'invoiceNumber', width: 18 },
      { header: 'STT', key: 'index', width: 6 },
      { header: 'Mã sản phẩm', key: 'productCode', width: 16 },
      { header: 'Tên hàng hóa / dịch vụ', key: 'name', width: 40 },
      { header: 'Đơn vị', key: 'unit', width: 10 },
      { header: 'Số lượng', key: 'quantity', width: 10, style: { numFmt: NUMBER } },
      { header: 'Đơn giá', key: 'unitPrice', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Thành tiền', key: 'amount', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Thuế suất', key: 'vatRate', width: 11, style: { numFmt: PERCENT } },
      { header: 'Tiền thuế', key: 'vatAmount', width: 16, style: { numFmt: CURRENCY } },
      { header: 'Tổng (có VAT)', key: 'totalWithVat', width: 18, style: { numFmt: CURRENCY } },
    ];

    for (const inv of invoices) {
      inv.lineItems.forEach((item, idx) => {
        sheet.addRow({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          index: idx + 1,
          productCode: item.productCode ?? '',
          name: item.name,
          unit: item.unit ?? '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          vatRate: item.vatRate,
          vatAmount: item.vatAmount,
          totalWithVat: item.totalWithVat,
        });
      });
    }

    this.styleHeaderRow(sheet.getRow(1));
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  /** Apply bold + filled styling to a header row. */
  private styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 22;
  }
}
