import { EditInvoiceUseCase } from '../edit-invoice.use-case';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import { Invoice } from '../../../domain/invoice/invoice.entity';

function createNeedsReviewInvoice(): Invoice {
  const invoice = Invoice.create({
    batchId: 'batch-1',
    originalFilename: 'test.pdf',
    storagePath: 'uploads/batch-1/test.pdf',
    fileHash: 'abc123',
    fileSizeBytes: 1024,
    pageCount: 1,
  });
  invoice.markAsProcessing();

  // Set extracted data to simulate processed state
  invoice.setExtractedData({
    schemaId: 'schema-1',
    classificationMethod: 'fingerprint',
    classificationConfidence: 0.95,
    invoiceNumber: 'INV-001',
    invoiceSymbol: 'AA/22E',
    invoiceDate: '2026-01-15',
    invoiceType: 'original',
    sellerName: 'Test Seller',
    sellerTaxId: '0302861742',
    buyerName: 'Test Buyer',
    buyerTaxId: '0312345678',
    subtotal: 1000000,
    vatRate: 10,
    vatAmount: 100000,
    total: 1100000,
    poNumber: null,
    lineItems: [],
    ocrRawText: 'sample text',
    extractedRawJson: '{}',
    fieldConfidences: null,
  });

  // Move to needs_review
  invoice.markAsNeedsReview();
  return invoice;
}

describe('EditInvoiceUseCase', () => {
  let sut: EditInvoiceUseCase;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;

  beforeEach(() => {
    invoiceRepo = {
      findById: jest.fn(),
      findByBatchId: jest.fn(),
      findByFileHash: jest.fn(),
      findDuplicate: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
    };
    sut = new EditInvoiceUseCase(invoiceRepo);
  });

  describe('execute', () => {
    it('should edit fields on a needs_review invoice', async () => {
      const invoice = createNeedsReviewInvoice();
      invoiceRepo.findById.mockResolvedValue(invoice);

      const result = await sut.execute({
        invoiceId: invoice.id,
        changes: {
          invoiceNumber: 'INV-002',
          total: 2200000,
        },
      });

      expect(result.invoiceId).toBe(invoice.id);
      expect(result.updatedFields).toContain('invoiceNumber');
      expect(result.updatedFields).toContain('total');
      expect(result.updatedFields).toHaveLength(2);
      expect(invoiceRepo.save).toHaveBeenCalled();
    });

    it('should maintain needs_review status after edit', async () => {
      const invoice = createNeedsReviewInvoice();
      invoiceRepo.findById.mockResolvedValue(invoice);

      await sut.execute({
        invoiceId: invoice.id,
        changes: { sellerName: 'New Seller' },
      });

      expect(invoice.status).toBe('needs_review');
    });

    it('should ignore non-editable fields', async () => {
      const invoice = createNeedsReviewInvoice();
      invoiceRepo.findById.mockResolvedValue(invoice);

      const result = await sut.execute({
        invoiceId: invoice.id,
        changes: {
          nonExistentField: 'value',
          anotherBad: 123,
        },
      });

      expect(result.updatedFields).toHaveLength(0);
      // Should not save if nothing changed
    });

    it('should throw when invoice not found', async () => {
      invoiceRepo.findById.mockResolvedValue(null);

      await expect(
        sut.execute({ invoiceId: 'nope', changes: { total: 1 } }),
      ).rejects.toThrow('Invoice not found: nope');
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
        sut.execute({ invoiceId: invoice.id, changes: { total: 1 } }),
      ).rejects.toThrow(/must be needs_review/);
    });
  });
});
