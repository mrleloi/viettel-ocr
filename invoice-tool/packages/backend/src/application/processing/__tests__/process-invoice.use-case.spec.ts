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
  findRecent: jest.fn().mockResolvedValue([]),
  findByFileHash: jest.fn().mockResolvedValue(null),
  findDuplicate: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  updateStatus: jest.fn().mockResolvedValue(undefined),
  findByFilters: jest.fn().mockResolvedValue([]),
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
  findAll: jest.fn().mockResolvedValue([]),
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
      expect(result.stages).toHaveLength(7);
      expect(result.stages.filter(s => s.status !== 'skipped').every(s => s.status === 'completed')).toBe(true);
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

  describe('maybe_create_schema stage', () => {
    it('should skip stage when schema was already matched via hint', async () => {
      const invoice = createTestInvoice();
      // Batch with hintSchemaId pre-selects the schema → matchedSchemaId is set → stage skips
      const batchWithHint = Batch.create({
        id: 'batch-1',
        uploadMode: 'single_ncc',
        totalFiles: 1,
        hintSchemaId: 'schema-1',
      });
      batchWithHint.startProcessing();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batchWithHint);
      schemaRepo.findById.mockResolvedValue(null); // schema lookup returns null → generic prompt
      ocrService.extract.mockResolvedValue(createOcrResult());

      const result = await sut.execute({ invoiceId: 'inv-1' });

      const stage = result.stages.find(s => s.stage === 'maybe_create_schema');
      expect(stage?.status).toBe('skipped');
    });

    it('should emit schema_suggestion when no schema matched and flag is OFF', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch(); // autoCreateSchemaOnNewPattern defaults to false
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      ruleRepo.findAllActive.mockResolvedValue([]);
      schemaRepo.findActive.mockResolvedValue([]);
      ocrService.extract.mockResolvedValue(createOcrResult());

      const mockCreateNotification = { execute: jest.fn().mockResolvedValue(undefined) };
      const sutWithNotification = new ProcessInvoiceUseCase(
        invoiceRepo,
        batchRepo,
        schemaRepo,
        ruleRepo,
        fieldDefRepo,
        ocrService,
        fileStorage,
        mockCreateNotification as never,
      );

      await sutWithNotification.execute({ invoiceId: 'inv-1' });

      const schemaSuggestionCall = mockCreateNotification.execute.mock.calls.find(
        (call: Array<Record<string, string>>) => call[0]?.category === 'schema_suggestion',
      );
      expect(schemaSuggestionCall).toBeDefined();
    });

    it('should call CreateSchemaUseCase when no schema matched and flag is ON', async () => {
      const invoice = createTestInvoice();
      const batchWithFlag = Batch.create({
        id: 'batch-1',
        uploadMode: 'single_ncc',
        totalFiles: 1,
        autoCreateSchemaOnNewPattern: true,
      });
      batchWithFlag.startProcessing();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batchWithFlag);
      ruleRepo.findAllActive.mockResolvedValue([]);
      schemaRepo.findActive.mockResolvedValue([]);
      ocrService.extract.mockResolvedValue(createOcrResult());

      const mockCreateSchema = { execute: jest.fn().mockResolvedValue({ schemaId: 'new-schema-1' }) };
      const sutWithSchema = new ProcessInvoiceUseCase(
        invoiceRepo,
        batchRepo,
        schemaRepo,
        ruleRepo,
        fieldDefRepo,
        ocrService,
        fileStorage,
        undefined,
        undefined,
        mockCreateSchema as never,
      );

      const result = await sutWithSchema.execute({ invoiceId: 'inv-1' });

      expect(mockCreateSchema.execute).toHaveBeenCalledWith(
        expect.objectContaining({ nccTaxId: expect.any(String) }),
      );
      const stage = result.stages.find(s => s.stage === 'maybe_create_schema');
      expect(stage?.status).toBe('completed');
    });
  });

  describe('error handling', () => {
    it('should throw when invoice not found', async () => {
      invoiceRepo.findById.mockResolvedValue(null);

      await expect(sut.execute({ invoiceId: 'nonexistent' }))
        .rejects.toThrow('Invoice not found');
    });

    it('should unwrap {value, confidence} envelopes inside line items (Gemini structured output)', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      let saved: Invoice | null = null;
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      invoiceRepo.save.mockImplementation(async (inv: Invoice) => { saved = inv; });

      // Mimic the production Gemini response: each line-item field wrapped in {value, confidence}
      ocrService.extract.mockResolvedValue({
        rawText: 'raw',
        extractedData: {
          invoice_number: { value: 'INV-NEG', confidence: 1 },
          invoice_symbol: { value: '1K26TAA', confidence: 1 },
          invoice_date: { value: '2026-05-05', confidence: 1 },
          seller_name: { value: 'Apple VN', confidence: 1 },
          seller_tax_id: { value: '0313510827', confidence: 1 },
          buyer_name: { value: 'Viettel', confidence: 1 },
          buyer_tax_id: { value: '0104831030', confidence: 1 },
          subtotal: { value: -7800000, confidence: 1 },
          vat_rate: { value: 8, confidence: 1 },
          vat_amount: { value: -624000, confidence: 1 },
          total: { value: -8424000, confidence: 1 },
          line_items: [
            {
              product_code: { value: 'MXP93ZP/A', confidence: 1 },
              name: { value: 'AIRPODS 4 ANC', confidence: 1 },
              unit: { value: 'Cái', confidence: 1 },
              quantity: { value: 1, confidence: 1 },
              unit_price: { value: -7800000, confidence: 1 },
              amount: { value: -7800000, confidence: 1 },
              vat_rate: { value: 8, confidence: 1 },
              vat_amount: { value: -624000, confidence: 1 },
              total_with_vat: { value: -8424000, confidence: 1 },
            },
          ],
        },
        fieldConfidences: {},
      });

      await sut.execute({ invoiceId: 'inv-1' });

      expect(saved).not.toBeNull();
      const items = saved!.lineItems;
      expect(items).toHaveLength(1);
      expect(items[0].productCode).toBe('MXP93ZP/A');
      expect(items[0].name).toBe('AIRPODS 4 ANC');
      expect(items[0].unit).toBe('Cái');
      expect(items[0].quantity).toBe(1);
      expect(items[0].unitPrice).toBe(-7800000);
      expect(items[0].amount).toBe(-7800000);
      expect(items[0].vatRate).toBe(8);
      expect(items[0].vatAmount).toBe(-624000);
      expect(items[0].totalWithVat).toBe(-8424000);
    });

    it('should self-heal header totals from line items when Gemini misses multi-page Sub-total', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      let saved: Invoice | null = null;
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      invoiceRepo.save.mockImplementation(async (inv: Invoice) => { saved = inv; });

      // Mimic real bug: Gemini parsed 5 line items across 2 pages correctly,
      // but reported header subtotal/vat/total by summing only the first 3 visible lines.
      ocrService.extract.mockResolvedValue({
        rawText: 'raw',
        extractedData: {
          invoice_number: 'INV-1',
          invoice_symbol: '1K26TAA',
          invoice_date: '2026-05-05',
          seller_name: 'Apple VN',
          seller_tax_id: '0313510827',
          buyer_name: 'Viettel',
          buyer_tax_id: '0104831030',
          // Header subtotal/vat/total reflect only the 3 first-page lines (WRONG)
          subtotal: -664500000,
          vat_rate: 8,
          vat_amount: -53160000,
          total: -717660000,
          line_items: [
            { product_code: 'MD4J4ZA/A', name: 'IPAD WIFI 256GB', unit: 'Cái', quantity: 1, unit_price: -1500000,    amount: -1500000,    vat_rate: 8, vat_amount: -120000,    total_with_vat: -1620000 },
            { product_code: 'MD4D4ZA/A', name: 'IPAD WIFI 128GB', unit: 'Cái', quantity: 1, unit_price: -172500000,  amount: -172500000,  vat_rate: 8, vat_amount: -13800000,  total_with_vat: -186300000 },
            { product_code: 'MD3Y4ZA/A', name: 'IPAD WIFI 128GB', unit: 'Cái', quantity: 1, unit_price: -490500000,  amount: -490500000,  vat_rate: 8, vat_amount: -39240000,  total_with_vat: -529740000 },
            { product_code: 'MD3Y4ZA/A', name: 'IPAD WIFI 128GB', unit: 'Cái', quantity: 1, unit_price: -826480000,  amount: -826480000,  vat_rate: 8, vat_amount: -66118400,  total_with_vat: -892598400 },
            { product_code: 'MD7K4ZA/A', name: 'IPAD WF CL 256GB', unit: 'Cái', quantity: 1, unit_price: -1500000,    amount: -1500000,    vat_rate: 8, vat_amount: -120000,    total_with_vat: -1620000 },
          ],
        },
        fieldConfidences: {},
      });

      await sut.execute({ invoiceId: 'inv-1' });

      expect(saved).not.toBeNull();
      // Self-heal should override header with line-item sums
      expect(saved!.subtotal).toBe(-1492480000);
      expect(saved!.vatAmount).toBe(-119398400);
      expect(saved!.total).toBe(-1611878400);
      expect(saved!.lineItems).toHaveLength(5);
    });

    it('should NOT self-heal when line items match header (everything consistent)', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      let saved: Invoice | null = null;
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);
      invoiceRepo.save.mockImplementation(async (inv: Invoice) => { saved = inv; });

      ocrService.extract.mockResolvedValue({
        rawText: 'raw',
        extractedData: {
          invoice_number: 'INV-2',
          invoice_symbol: 'AA/26E',
          invoice_date: '2026-05-05',
          seller_name: 'X',
          seller_tax_id: '0123456789',
          buyer_name: 'Y',
          buyer_tax_id: '9876543210',
          subtotal: 1000000,
          vat_rate: 10,
          vat_amount: 100000,
          total: 1100000,
          line_items: [
            { name: 'Item A', unit: 'cái', quantity: 2, unit_price: 500000, amount: 1000000, vat_rate: 10, vat_amount: 100000, total_with_vat: 1100000 },
          ],
        },
        fieldConfidences: {},
      });

      await sut.execute({ invoiceId: 'inv-1' });

      expect(saved).not.toBeNull();
      expect(saved!.subtotal).toBe(1000000);
      expect(saved!.vatAmount).toBe(100000);
      expect(saved!.total).toBe(1100000);
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
