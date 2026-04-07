import { RejectInvoiceUseCase } from '../reject-invoice.use-case';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import type { IBatchRepository } from '../../../domain/batch/batch.repository';
import { Invoice } from '../../../domain/invoice/invoice.entity';
import { Batch } from '../../../domain/batch/batch.entity';

function createTestInvoice(): Invoice {
  const invoice = Invoice.create({
    batchId: 'batch-1',
    originalFilename: 'test.pdf',
    storagePath: 'uploads/batch-1/test.pdf',
    fileHash: 'abc123',
    fileSizeBytes: 1024,
    pageCount: 1,
  });
  invoice.markAsProcessing();
  invoice.markAsNeedsReview();
  return invoice;
}

function createTestBatch(): Batch {
  const batch = Batch.create({
    uploadMode: 'single_ncc',
    totalFiles: 1,
    hintSchemaId: null,
  });
  batch.startProcessing();
  return batch;
}

describe('RejectInvoiceUseCase', () => {
  let sut: RejectInvoiceUseCase;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;
  let batchRepo: jest.Mocked<IBatchRepository>;

  beforeEach(() => {
    invoiceRepo = {
      findById: jest.fn(),
      findByBatchId: jest.fn(),
      findByFileHash: jest.fn(),
      findDuplicate: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
    };
    batchRepo = {
      findById: jest.fn(),
      findRecent: jest.fn(),
      save: jest.fn(),
      updateCounters: jest.fn(),
    };
    sut = new RejectInvoiceUseCase(invoiceRepo, batchRepo);
  });

  describe('execute', () => {
    it('should reject an invoice with a valid reason', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      const result = await sut.execute({
        invoiceId: invoice.id,
        reviewedBy: 'reviewer-1',
        reason: 'Invalid data',
      });

      expect(result.previousStatus).toBe('needs_review');
      expect(result.newStatus).toBe('rejected');
      expect(result.invoiceId).toBe(invoice.id);
      expect(invoiceRepo.save).toHaveBeenCalledWith(invoice);
    });

    it('should update batch counters as error after rejection', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      await sut.execute({
        invoiceId: invoice.id,
        reviewedBy: 'r1',
        reason: 'Bad scan',
      });

      expect(batchRepo.save).toHaveBeenCalledWith(batch);
      expect(batch.errorFiles).toBe(1);
    });

    it('should throw when invoice not found', async () => {
      invoiceRepo.findById.mockResolvedValue(null);

      await expect(
        sut.execute({ invoiceId: 'no-such', reviewedBy: 'r1', reason: 'reason' }),
      ).rejects.toThrow('Invoice not found: no-such');
    });

    it('should throw when reason is empty', async () => {
      await expect(
        sut.execute({ invoiceId: 'inv-1', reviewedBy: 'r1', reason: '' }),
      ).rejects.toThrow('Rejection reason is required');
    });

    it('should throw when reason is whitespace only', async () => {
      await expect(
        sut.execute({ invoiceId: 'inv-1', reviewedBy: 'r1', reason: '   ' }),
      ).rejects.toThrow('Rejection reason is required');
    });

    it('should throw when invoice is not in needs_review status', async () => {
      const invoice = Invoice.create({
        batchId: 'batch-1',
        originalFilename: 'test.pdf',
        storagePath: 'uploads/batch-1/test.pdf',
        fileHash: 'abc123',
        fileSizeBytes: 1024,
        pageCount: 1,
      });
      invoiceRepo.findById.mockResolvedValue(invoice);

      await expect(
        sut.execute({ invoiceId: invoice.id, reviewedBy: 'r1', reason: 'bad data' }),
      ).rejects.toThrow(/Cannot reject invoice/);
    });
  });
});
