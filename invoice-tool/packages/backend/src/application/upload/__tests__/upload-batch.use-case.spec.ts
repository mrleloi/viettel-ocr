import { UploadBatchUseCase, UploadBatchInput, UploadFileInput } from '../upload-batch.use-case';
import type { IBatchRepository } from '../../../domain/batch/batch.repository';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import type { IFileStorage } from '../../../domain/shared/file-storage';
import type { IJobQueue } from '../../../domain/shared/job-queue';
import { Invoice } from '../../../domain/invoice/invoice.entity';

const createMockBatchRepo = (): jest.Mocked<IBatchRepository> => ({
  findById: jest.fn().mockResolvedValue(null),
  findRecent: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue(undefined),
  updateCounters: jest.fn().mockResolvedValue(undefined),
});

const createMockInvoiceRepo = (): jest.Mocked<IInvoiceRepository> => ({
  findById: jest.fn().mockResolvedValue(null),
  findByBatchId: jest.fn().mockResolvedValue([]),
  findRecent: jest.fn().mockResolvedValue([]),
  findByFileHash: jest.fn().mockResolvedValue(null),
  findDuplicate: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  updateStatus: jest.fn().mockResolvedValue(undefined),
  findByFilters: jest.fn().mockResolvedValue([]),
});

const createMockFileStorage = (): jest.Mocked<IFileStorage> => ({
  saveFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('')),
  readFileAsBase64: jest.fn().mockResolvedValue(''),
  fileExists: jest.fn().mockResolvedValue(false),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  listFiles: jest.fn().mockResolvedValue([]),
  ensureDir: jest.fn().mockResolvedValue(undefined),
});

const createMockJobQueue = (): jest.Mocked<IJobQueue> => ({
  enqueue: jest.fn().mockResolvedValue('job-1'),
  takePending: jest.fn().mockResolvedValue([]),
  markCompleted: jest.fn().mockResolvedValue(undefined),
  markFailed: jest.fn().mockResolvedValue(undefined),
  resetStaleJobs: jest.fn().mockResolvedValue(0),
  countPending: jest.fn().mockResolvedValue(0),
});

const makePdf = (name = 'invoice.pdf', sizeKB = 100): UploadFileInput => ({
  filename: name,
  content: Buffer.alloc(sizeKB * 1024, 'a'),
  mimeType: 'application/pdf',
});

describe('UploadBatchUseCase', () => {
  let sut: UploadBatchUseCase;
  let batchRepo: jest.Mocked<IBatchRepository>;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;
  let fileStorage: jest.Mocked<IFileStorage>;
  let jobQueue: jest.Mocked<IJobQueue>;

  beforeEach(() => {
    batchRepo = createMockBatchRepo();
    invoiceRepo = createMockInvoiceRepo();
    fileStorage = createMockFileStorage();
    jobQueue = createMockJobQueue();
    sut = new UploadBatchUseCase(batchRepo, invoiceRepo, fileStorage, jobQueue);
  });

  describe('happy path', () => {
    it('should create a batch and accept valid PDF files', async () => {
      const input: UploadBatchInput = {
        files: [makePdf('inv1.pdf'), makePdf('inv2.pdf')],
        uploadMode: 'single_ncc',
        hintSchemaId: 'schema-1',
      };

      const result = await sut.execute(input);

      expect(result.batchId).toBeDefined();
      expect(result.totalFiles).toBe(2);
      expect(result.acceptedFiles).toBe(2);
      expect(result.rejectedFiles).toBe(0);
      expect(result.duplicateFiles).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('accepted');
      expect(result.results[0].invoiceId).toBeDefined();
    });

    it('should save batch and all invoices to repositories', async () => {
      const input: UploadBatchInput = {
        files: [makePdf('inv1.pdf')],
        uploadMode: 'mixed',
      };

      await sut.execute(input);

      // Batch saved twice: initial + after startProcessing
      expect(batchRepo.save).toHaveBeenCalledTimes(2);
      expect(invoiceRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should save files to storage with correct path', async () => {
      const input: UploadBatchInput = {
        files: [makePdf('inv1.pdf')],
        uploadMode: 'single_ncc',
      };

      const result = await sut.execute(input);

      expect(fileStorage.saveFile).toHaveBeenCalledTimes(1);
      const savedPath = fileStorage.saveFile.mock.calls[0][0];
      expect(savedPath).toContain(`uploads/${result.batchId}/inv1.pdf`);
    });

    it('should enqueue accepted invoices for processing', async () => {
      const input: UploadBatchInput = {
        files: [makePdf('inv1.pdf'), makePdf('inv2.pdf')],
        uploadMode: 'single_ncc',
      };

      await sut.execute(input);

      expect(jobQueue.enqueue).toHaveBeenCalledTimes(2);
    });
  });

  describe('file validation', () => {
    it('should reject non-PDF files', async () => {
      const input: UploadBatchInput = {
        files: [{
          filename: 'data.xlsx',
          content: Buffer.alloc(1024, 'a'),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }],
        uploadMode: 'single_ncc',
      };

      const result = await sut.execute(input);

      expect(result.rejectedFiles).toBe(1);
      expect(result.acceptedFiles).toBe(0);
      expect(result.results[0].status).toBe('rejected');
      expect(result.results[0].reason).toContain('Not a PDF');
    });

    it('should reject files larger than 20MB', async () => {
      const input: UploadBatchInput = {
        files: [makePdf('big.pdf', 21 * 1024)], // 21 MB
        uploadMode: 'single_ncc',
      };

      const result = await sut.execute(input);

      expect(result.rejectedFiles).toBe(1);
      expect(result.results[0].status).toBe('rejected');
      expect(result.results[0].reason).toContain('too large');
    });

    it('should reject empty files', async () => {
      const input: UploadBatchInput = {
        files: [{
          filename: 'empty.pdf',
          content: Buffer.alloc(0),
          mimeType: 'application/pdf',
        }],
        uploadMode: 'single_ncc',
      };

      const result = await sut.execute(input);

      expect(result.rejectedFiles).toBe(1);
      expect(result.results[0].reason).toContain('empty');
    });
  });

  describe('duplicate detection', () => {
    it('should detect duplicate by file hash', async () => {
      // Simulate existing invoice with matching hash
      const existingInvoice = { id: 'existing-inv-1' } as Invoice;
      invoiceRepo.findByFileHash.mockResolvedValueOnce(existingInvoice);

      const input: UploadBatchInput = {
        files: [makePdf('dup.pdf')],
        uploadMode: 'single_ncc',
      };

      const result = await sut.execute(input);

      expect(result.duplicateFiles).toBe(1);
      expect(result.acceptedFiles).toBe(0);
      expect(result.results[0].status).toBe('duplicate');
      expect(result.results[0].duplicateOfId).toBe('existing-inv-1');
    });

    it('should not enqueue duplicate invoices', async () => {
      const existingInvoice = { id: 'existing-inv-1' } as Invoice;
      invoiceRepo.findByFileHash.mockResolvedValue(existingInvoice);

      const input: UploadBatchInput = {
        files: [makePdf('dup1.pdf'), makePdf('dup2.pdf')],
        uploadMode: 'single_ncc',
      };

      await sut.execute(input);

      expect(jobQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('mixed results', () => {
    it('should handle mix of accepted, rejected, and duplicate files', async () => {
      const existingInvoice = { id: 'existing-1' } as Invoice;
      // Third file is duplicate
      invoiceRepo.findByFileHash
        .mockResolvedValueOnce(null) // first file: unique
        .mockResolvedValueOnce(existingInvoice); // second PDF: duplicate

      const input: UploadBatchInput = {
        files: [
          makePdf('good.pdf'),
          makePdf('dup.pdf'),
          { filename: 'bad.xlsx', content: Buffer.alloc(100), mimeType: 'text/plain' },
        ],
        uploadMode: 'mixed',
      };

      const result = await sut.execute(input);

      expect(result.totalFiles).toBe(3);
      expect(result.acceptedFiles).toBe(1);
      expect(result.duplicateFiles).toBe(1);
      expect(result.rejectedFiles).toBe(1);
      expect(jobQueue.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should not transition batch to processing when no files accepted', async () => {
      const input: UploadBatchInput = {
        files: [{ filename: 'bad.txt', content: Buffer.alloc(100), mimeType: 'text/plain' }],
        uploadMode: 'single_ncc',
      };

      await sut.execute(input);

      // Should save batch only once (initial save, no startProcessing)
      expect(batchRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('duplicate policy — onDuplicate flag', () => {
    it('should default to skip when onDuplicate is not provided', async () => {
      const existingInvoice = Invoice.reconstitute({
        id: 'existing-inv-1', batchId: 'old-batch', originalFilename: 'orig.pdf',
        storagePath: '/p/orig.pdf', fileHash: '', fileSizeBytes: 1024, pageCount: 1,
        status: 'approved', schemaId: null, classificationMethod: null,
        classificationConfidence: null, invoiceNumber: null, invoiceSymbol: null,
        invoiceDate: null, invoiceType: null, sellerName: null, sellerTaxId: null,
        buyerName: null, buyerTaxId: null, subtotal: null, vatRate: null,
        vatAmount: null, total: null, poNumber: null, lineItems: [],
        overallConfidence: null, ocrRawText: null, extractedRawJson: null,
        validationErrors: null, fieldConfidences: null, duplicateOf: null,
        createdAt: new Date(), updatedAt: new Date(), processedAt: null,
        reviewedAt: null, reviewedBy: null,
      });
      invoiceRepo.findByFileHash.mockResolvedValueOnce(existingInvoice);

      const input: UploadBatchInput = {
        files: [makePdf('dup.pdf')],
        uploadMode: 'single_ncc',
        // onDuplicate not specified → defaults to skip
      };

      const result = await sut.execute(input);

      expect(result.duplicateFiles).toBe(1);
      expect(result.acceptedFiles).toBe(0);
      expect(result.results[0].status).toBe('duplicate');
      expect(jobQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should enqueue existing invoice when onDuplicate is process_anyway', async () => {
      const existingInvoice = Invoice.reconstitute({
        id: 'existing-inv-1', batchId: 'old-batch', originalFilename: 'orig.pdf',
        storagePath: '/p/orig.pdf', fileHash: '', fileSizeBytes: 1024, pageCount: 1,
        status: 'approved', schemaId: 'schema-1', classificationMethod: 'fingerprint',
        classificationConfidence: 0.9, invoiceNumber: '001', invoiceSymbol: null,
        invoiceDate: '2026-04-07', invoiceType: 'original', sellerName: 'Seller',
        sellerTaxId: '123', buyerName: 'Buyer', buyerTaxId: '456',
        subtotal: 1000, vatRate: 10, vatAmount: 100, total: 1100, poNumber: null,
        lineItems: [], overallConfidence: 0.85, ocrRawText: 'text',
        extractedRawJson: '{}', validationErrors: null, fieldConfidences: null,
        duplicateOf: null, createdAt: new Date(), updatedAt: new Date(),
        processedAt: new Date(), reviewedAt: null, reviewedBy: null,
      });
      invoiceRepo.findByFileHash.mockResolvedValueOnce(existingInvoice);

      const input: UploadBatchInput = {
        files: [makePdf('dup.pdf')],
        uploadMode: 'single_ncc',
        onDuplicate: 'process_anyway',
      };

      const result = await sut.execute(input);

      // Existing invoice should be reprocessed, not a new one created
      expect(result.acceptedFiles).toBe(1);
      expect(result.duplicateFiles).toBe(0);
      expect(result.results[0].status).toBe('accepted');
      expect(result.results[0].invoiceId).toBe('existing-inv-1');
      expect(result.results[0].duplicateOfId).toBe('existing-inv-1');
      // The existing invoice should be saved (after resumeForReprocess) and enqueued
      expect(invoiceRepo.save).toHaveBeenCalled();
      expect(jobQueue.enqueue).toHaveBeenCalledWith('existing-inv-1');
    });

    it('should mark as duplicate without enqueue when onDuplicate is flag_only', async () => {
      const existingInvoice = Invoice.reconstitute({
        id: 'existing-inv-1', batchId: 'old-batch', originalFilename: 'orig.pdf',
        storagePath: '/p/orig.pdf', fileHash: '', fileSizeBytes: 1024, pageCount: 1,
        status: 'approved', schemaId: null, classificationMethod: null,
        classificationConfidence: null, invoiceNumber: null, invoiceSymbol: null,
        invoiceDate: null, invoiceType: null, sellerName: null, sellerTaxId: null,
        buyerName: null, buyerTaxId: null, subtotal: null, vatRate: null,
        vatAmount: null, total: null, poNumber: null, lineItems: [],
        overallConfidence: null, ocrRawText: null, extractedRawJson: null,
        validationErrors: null, fieldConfidences: null, duplicateOf: null,
        createdAt: new Date(), updatedAt: new Date(), processedAt: null,
        reviewedAt: null, reviewedBy: null,
      });
      invoiceRepo.findByFileHash.mockResolvedValueOnce(existingInvoice);

      const input: UploadBatchInput = {
        files: [makePdf('dup.pdf')],
        uploadMode: 'single_ncc',
        onDuplicate: 'flag_only',
      };

      const result = await sut.execute(input);

      expect(result.duplicateFiles).toBe(1);
      expect(result.acceptedFiles).toBe(0);
      expect(result.results[0].status).toBe('duplicate');
      expect(jobQueue.enqueue).not.toHaveBeenCalled();
    });
  });
});
