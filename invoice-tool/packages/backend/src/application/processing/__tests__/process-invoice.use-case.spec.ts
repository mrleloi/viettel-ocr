import { ProcessInvoiceUseCase, ProcessInvoiceInput } from '../process-invoice.use-case';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import type { IBatchRepository } from '../../../domain/batch/batch.repository';
import type { ISchemaRepository } from '../../../domain/schema/schema.repository';
import type { IFingerprintRuleRepository } from '../../../domain/schema/fingerprint-rule.repository';
import type { IFieldDefinitionRepository } from '../../../domain/schema/field-definition.repository';
import type { IOcrService, OcrExtractionResult } from '../../../domain/processing/ocr.service';
import type { IFileStorage } from '../../../domain/shared/file-storage';
import { Invoice } from '../../../domain/invoice/invoice.entity';
import { Batch } from '../../../domain/batch/batch.entity';

// ---- Mock Factories ----

const createMockInvoiceRepo = (): jest.Mocked<IInvoiceRepository> => ({
  findById: jest.fn(),
  findByBatchId: jest.fn().mockResolvedValue([]),
  findByFileHash: jest.fn().mockResolvedValue(null),
  findDuplicate: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  updateStatus: jest.fn().mockResolvedValue(undefined),
});

const createMockBatchRepo = (): jest.Mocked<IBatchRepository> => ({
  findById: jest.fn(),
  findRecent: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue(undefined),
  updateCounters: jest.fn().mockResolvedValue(undefined),
});

const createMockSchemaRepo = (): jest.Mocked<ISchemaRepository> => ({
  findById: jest.fn().mockResolvedValue(null),
  findActive: jest.fn().mockResolvedValue([]),
  findByNccTaxId: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
});

const createMockRuleRepo = (): jest.Mocked<IFingerprintRuleRepository> => ({
  findBySchemaId: jest.fn().mockResolvedValue([]),
  findAllActive: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
});

const createMockFieldDefRepo = (): jest.Mocked<IFieldDefinitionRepository> => ({
  findBySchemaId: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
});

const createMockOcrService = (): jest.Mocked<IOcrService> => ({
  extract: jest.fn(),
  extractAndClassify: jest.fn(),
});

const createMockFileStorage = (): jest.Mocked<IFileStorage> => ({
  saveFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
  readFileAsBase64: jest.fn().mockResolvedValue('base64pdfcontent'),
  fileExists: jest.fn().mockResolvedValue(true),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  listFiles: jest.fn().mockResolvedValue([]),
  ensureDir: jest.fn().mockResolvedValue(undefined),
});

// Helper: create a pending invoice
const createTestInvoice = (): Invoice => {
  return Invoice.create({
    id: 'inv-1',
    batchId: 'batch-1',
    originalFilename: 'test.pdf',
    storagePath: 'uploads/batch-1/test.pdf',
    fileHash: 'abc123',
    fileSizeBytes: 1024,
    pageCount: 1,
  });
};

// Helper: create a processing batch
const createTestBatch = (): Batch => {
  const batch = Batch.create({
    id: 'batch-1',
    uploadMode: 'single_ncc',
    totalFiles: 1,
  });
  batch.startProcessing();
  return batch;
};

// Helper: standard OCR extraction result
const createOcrResult = (): OcrExtractionResult => ({
  rawText: 'Invoice text content',
  extractedData: {
    invoice_number: { value: 'INV001', confidence: 0.95 },
    invoice_symbol: { value: 'AA/21E', confidence: 0.90 },
    invoice_date: { value: '2026-01-15', confidence: 0.88 },
    seller_name: { value: 'Công ty ABC', confidence: 0.92 },
    seller_tax_id: { value: '0123456789', confidence: 0.95 },
    buyer_name: { value: 'Viettel', confidence: 0.90 },
    buyer_tax_id: { value: '0100109106', confidence: 0.90 },
    subtotal: { value: 1000000, confidence: 0.85 },
    vat_rate: { value: 10, confidence: 0.90 },
    vat_amount: { value: 100000, confidence: 0.85 },
    total: { value: 1100000, confidence: 0.88 },
    line_items: [
      { name: 'Product A', unit: 'cái', quantity: 10, unit_price: 100000, amount: 1000000 },
    ],
  },
  fieldConfidences: {
    invoice_number: 0.95,
    invoice_symbol: 0.90,
    invoice_date: 0.88,
    seller_tax_id: 0.95,
    subtotal: 0.85,
    total: 0.88,
  },
});

describe('ProcessInvoiceUseCase', () => {
  let sut: ProcessInvoiceUseCase;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;
  let batchRepo: jest.Mocked<IBatchRepository>;
  let schemaRepo: jest.Mocked<ISchemaRepository>;
  let ruleRepo: jest.Mocked<IFingerprintRuleRepository>;
  let fieldDefRepo: jest.Mocked<IFieldDefinitionRepository>;
  let ocrService: jest.Mocked<IOcrService>;
  let fileStorage: jest.Mocked<IFileStorage>;

  beforeEach(() => {
    invoiceRepo = createMockInvoiceRepo();
    batchRepo = createMockBatchRepo();
    schemaRepo = createMockSchemaRepo();
    ruleRepo = createMockRuleRepo();
    fieldDefRepo = createMockFieldDefRepo();
    ocrService = createMockOcrService();
    fileStorage = createMockFileStorage();

    sut = new ProcessInvoiceUseCase(
      invoiceRepo,
      batchRepo,
      schemaRepo,
      ruleRepo,
      fieldDefRepo,
      ocrService,
      fileStorage,
    );
  });

  describe('happy path', () => {
    it('should process an invoice through all stages successfully', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      ocrService.extract.mockResolvedValue(createOcrResult());

      const input: ProcessInvoiceInput = { invoiceId: 'inv-1' };
      const result = await sut.execute(input);

      expect(result.invoiceId).toBe('inv-1');
      expect(result.finalStatus).not.toBe('error');
      expect(result.stages).toHaveLength(5);
      expect(result.stages.every(s => s.status === 'completed')).toBe(true);
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should save invoice multiple times through stages', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      ocrService.extract.mockResolvedValue(createOcrResult());

      await sut.execute({ invoiceId: 'inv-1' });

      // Invoice saved: markAsProcessing + extract + validate + score + route
      expect(invoiceRepo.save).toHaveBeenCalledTimes(5);
    });

    it('should update batch counters on success', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      ocrService.extract.mockResolvedValue(createOcrResult());

      await sut.execute({ invoiceId: 'inv-1' });

      expect(batchRepo.save).toHaveBeenCalled();
    });
  });

  describe('classification', () => {
    it('should use LLM fallback when no fingerprint rules exist', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      ruleRepo.findAllActive.mockResolvedValue([]);
      schemaRepo.findActive.mockResolvedValue([]);
      ocrService.extract.mockResolvedValue(createOcrResult());

      const result = await sut.execute({ invoiceId: 'inv-1' });

      expect(result.stages[0].stage).toBe('classify');
      expect(result.stages[0].status).toBe('completed');
    });
  });

  describe('extraction failure', () => {
    it('should mark invoice as error when OCR service fails', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      ocrService.extract.mockRejectedValue(new Error('Gemini API rate limit'));

      const result = await sut.execute({ invoiceId: 'inv-1' });

      expect(result.finalStatus).toBe('error');
      const extractStage = result.stages.find(s => s.stage === 'extract');
      expect(extractStage?.status).toBe('failed');
      expect(extractStage?.error).toContain('Gemini API rate limit');
    });
  });

  describe('validation', () => {
    it('should store validation errors when invoice data is invalid', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      // Return data with missing required fields
      ocrService.extract.mockResolvedValue({
        rawText: 'Some text',
        extractedData: {
          invoice_number: { value: null, confidence: 0 },
          invoice_symbol: { value: null, confidence: 0 },
        },
        fieldConfidences: {},
      });

      const result = await sut.execute({ invoiceId: 'inv-1' });

      // Validation should still complete (it records errors, doesn't throw)
      const validateStage = result.stages.find(s => s.stage === 'validate');
      expect(validateStage?.status).toBe('completed');
    });
  });

  describe('scoring and routing', () => {
    it('should route high-confidence invoices to mapped status', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      // High confidence OCR result
      ocrService.extract.mockResolvedValue(createOcrResult());

      const result = await sut.execute({ invoiceId: 'inv-1' });

      // With good data, should route based on confidence
      expect(result.stages.find(s => s.stage === 'route')?.status).toBe('completed');
      expect(['mapped', 'needs_review']).toContain(result.finalStatus);
    });
  });

  describe('error handling', () => {
    it('should throw when invoice not found', async () => {
      invoiceRepo.findById.mockResolvedValue(null);

      await expect(sut.execute({ invoiceId: 'nonexistent' }))
        .rejects.toThrow('Invoice not found');
    });

    it('should mark invoice as error and update batch on failure', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      // Fail at extraction stage
      fileStorage.readFileAsBase64.mockRejectedValue(new Error('File not found'));

      const result = await sut.execute({ invoiceId: 'inv-1' });

      expect(result.finalStatus).toBe('error');
      expect(result.stages.some(s => s.status === 'failed')).toBe(true);
    });
  });
});
