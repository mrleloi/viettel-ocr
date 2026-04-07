import { ApproveInvoiceUseCase } from '../approve-invoice.use-case';
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
  // Transition to needs_review so approve can work
  invoice.markAsProcessing();
  invoice.markAsNeedsReview();
  return invoice;
}

function createTestBatch(): Batch {
  return Batch.create({
    uploadMode: 'single_ncc',
    totalFiles: 1,
    hintSchemaId: null,
  });
}

describe('ApproveInvoiceUseCase', () => {
  let sut: ApproveInvoiceUseCase;
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
    sut = new ApproveInvoiceUseCase(invoiceRepo, batchRepo);
  });

  describe('execute', () => {
    it('should approve an invoice in needs_review status', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      batch.startProcessing();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      const result = await sut.execute({
        invoiceId: invoice.id,
        reviewedBy: 'reviewer-1',
      });

      expect(result.previousStatus).toBe('needs_review');
      expect(result.newStatus).toBe('approved');
      expect(result.invoiceId).toBe(invoice.id);
      expect(invoiceRepo.save).toHaveBeenCalledWith(invoice);
    });

    it('should update batch counters after approval', async () => {
      const invoice = createTestInvoice();
      const batch = createTestBatch();
      batch.startProcessing();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(batch);

      await sut.execute({
        invoiceId: invoice.id,
        reviewedBy: 'reviewer-1',
      });

      expect(batchRepo.save).toHaveBeenCalledWith(batch);
      expect(batch.processedFiles).toBe(1);
      expect(batch.successFiles).toBe(1);
    });

    it('should throw when invoice not found', async () => {
      invoiceRepo.findById.mockResolvedValue(null);

      await expect(
        sut.execute({ invoiceId: 'nonexistent', reviewedBy: 'r1' }),
      ).rejects.toThrow('Invoice not found: nonexistent');
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
      // Invoice is in 'pending' status — not needs_review
      invoiceRepo.findById.mockResolvedValue(invoice);

      await expect(
        sut.execute({ invoiceId: invoice.id, reviewedBy: 'r1' }),
      ).rejects.toThrow(/Cannot approve invoice/);
    });

    it('should succeed even if batch is not found', async () => {
      const invoice = createTestInvoice();
      invoiceRepo.findById.mockResolvedValue(invoice);
      batchRepo.findById.mockResolvedValue(null);

      const result = await sut.execute({
        invoiceId: invoice.id,
        reviewedBy: 'r1',
      });

      expect(result.newStatus).toBe('approved');
      expect(batchRepo.save).not.toHaveBeenCalled();
    });
  });
});
