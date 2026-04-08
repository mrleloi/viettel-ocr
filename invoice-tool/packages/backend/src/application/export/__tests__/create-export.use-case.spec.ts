import { CreateExportUseCase } from '../create-export.use-case';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import type { IFileStorage } from '../../../domain/shared/file-storage';
import { Invoice } from '../../../domain/invoice/invoice.entity';

function createApprovedInvoice(overrides?: { invoiceNumber?: string; schemaId?: string }): Invoice {
  const invoice = Invoice.create({
    batchId: 'batch-1',
    originalFilename: 'test.pdf',
    storagePath: 'uploads/batch-1/test.pdf',
    fileHash: `hash-${Math.random().toString(36).slice(2, 8)}`,
    fileSizeBytes: 1024,
    pageCount: 1,
  });
  invoice.markAsProcessing();
  invoice.setExtractedData({
    schemaId: overrides?.schemaId ?? 'schema-1',
    classificationMethod: 'fingerprint',
    classificationConfidence: 0.95,
    invoiceNumber: overrides?.invoiceNumber ?? 'INV-001',
    invoiceSymbol: 'AA/22E',
    invoiceDate: '2026-01-15',
    invoiceType: 'original',
    sellerName: 'Seller Corp',
    sellerTaxId: '0302861742',
    buyerName: 'Buyer Corp',
    buyerTaxId: '0312345678',
    subtotal: 1000000,
    vatRate: 10,
    vatAmount: 100000,
    total: 1100000,
    poNumber: null,
    lineItems: [],
    ocrRawText: 'raw text',
    extractedRawJson: '{}',
    fieldConfidences: null,
  });
  invoice.markAsNeedsReview();
  invoice.approve('reviewer-1');
  return invoice;
}

describe('CreateExportUseCase', () => {
  let sut: CreateExportUseCase;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;
  let fileStorage: jest.Mocked<IFileStorage>;

  beforeEach(() => {
    invoiceRepo = {
      findById: jest.fn(),
      findByBatchId: jest.fn(),
      findRecent: jest.fn(),
      findByFileHash: jest.fn(),
      findDuplicate: jest.fn(),
      findByFilters: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
    };
    fileStorage = {
      saveFile: jest.fn(),
      readFile: jest.fn(),
      readFileAsBase64: jest.fn(),
      fileExists: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn(),
      ensureDir: jest.fn(),
    };
    sut = new CreateExportUseCase(invoiceRepo, fileStorage);
  });

  describe('execute', () => {
    it('should export approved invoices as CSV', async () => {
      const inv1 = createApprovedInvoice({ invoiceNumber: 'INV-001' });
      const inv2 = createApprovedInvoice({ invoiceNumber: 'INV-002' });
      invoiceRepo.findByBatchId.mockResolvedValue([inv1, inv2]);

      const result = await sut.execute({
        format: 'csv',
        batchId: 'batch-1',
      });

      expect(result.recordCount).toBe(2);
      expect(result.filename).toContain('.csv');
      expect(result.fileSizeBytes).toBeGreaterThan(0);
      expect(fileStorage.saveFile).toHaveBeenCalledTimes(1);

      // Verify the saved content is CSV
      const savedContent = fileStorage.saveFile.mock.calls[0][1].toString('utf-8');
      expect(savedContent).toContain('invoiceNumber');
      expect(savedContent).toContain('INV-001');
      expect(savedContent).toContain('INV-002');
    });

    it('should export approved invoices as JSON', async () => {
      const inv1 = createApprovedInvoice({ invoiceNumber: 'INV-001' });
      invoiceRepo.findByBatchId.mockResolvedValue([inv1]);

      const result = await sut.execute({
        format: 'json',
        batchId: 'batch-1',
      });

      expect(result.recordCount).toBe(1);
      expect(result.filename).toContain('.json');

      const savedContent = fileStorage.saveFile.mock.calls[0][1].toString('utf-8');
      const parsed = JSON.parse(savedContent);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].invoiceNumber).toBe('INV-001');
    });

    it('should create empty file when no matching invoices', async () => {
      invoiceRepo.findByBatchId.mockResolvedValue([]);

      const result = await sut.execute({
        format: 'csv',
        batchId: 'batch-1',
      });

      expect(result.recordCount).toBe(0);
      expect(result.fileSizeBytes).toBeGreaterThan(0); // CSV headers still present
      expect(fileStorage.saveFile).toHaveBeenCalledTimes(1);
    });

    it('should throw for invalid format', async () => {
      await expect(
        sut.execute({
          format: 'xlsx' as 'csv',
          batchId: 'batch-1',
        }),
      ).rejects.toThrow(/Invalid export format/);
    });

    it('should filter only approved invoices from batch', async () => {
      const approved = createApprovedInvoice({ invoiceNumber: 'INV-OK' });
      const pending = Invoice.create({
        batchId: 'batch-1',
        originalFilename: 'pending.pdf',
        storagePath: 'uploads/batch-1/pending.pdf',
        fileHash: 'hash-pending',
        fileSizeBytes: 512,
        pageCount: 1,
      });
      invoiceRepo.findByBatchId.mockResolvedValue([approved, pending]);

      const result = await sut.execute({
        format: 'json',
        batchId: 'batch-1',
      });

      expect(result.recordCount).toBe(1);
    });

    it('should call findByFilters when batchId not provided with statusFilter', async () => {
      const inv1 = createApprovedInvoice({ invoiceNumber: 'INV-F1' });
      invoiceRepo.findByFilters.mockResolvedValue([inv1]);

      const result = await sut.execute({
        format: 'csv',
        statusFilter: 'approved',
      });

      expect(invoiceRepo.findByFilters).toHaveBeenCalledWith({
        status: 'approved',
        schemaId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
      expect(result.recordCount).toBe(1);
    });

    it('should call findByFilters with empty filters when no batchId and no statusFilter', async () => {
      const inv1 = createApprovedInvoice({ invoiceNumber: 'INV-F2' });
      const inv2 = createApprovedInvoice({ invoiceNumber: 'INV-F3' });
      invoiceRepo.findByFilters.mockResolvedValue([inv1, inv2]);

      const result = await sut.execute({
        format: 'json',
      });

      expect(invoiceRepo.findByFilters).toHaveBeenCalledWith({
        status: undefined,
        schemaId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
      expect(result.recordCount).toBe(2);
    });
  });
});
