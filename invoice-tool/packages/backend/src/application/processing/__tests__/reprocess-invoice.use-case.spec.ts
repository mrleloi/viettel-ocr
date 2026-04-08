import { ReprocessInvoiceUseCase } from '../reprocess-invoice.use-case';
import { Invoice } from '../../../domain/invoice/invoice.entity';
import { DomainError } from '../../../domain/shared/domain-error';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import type { IJobQueue } from '../../../domain/shared/job-queue';
import type { CreateNotificationUseCase } from '../../notification/create-notification.use-case';
import type { InvoiceStatus } from '@invoice-tool/shared';

function createMockInvoice(status: InvoiceStatus = 'approved'): Invoice {
  return Invoice.reconstitute({
    id: 'inv-1', batchId: 'b-1', originalFilename: 'test.pdf',
    storagePath: '/p/test.pdf', fileHash: 'hash123', fileSizeBytes: 1024, pageCount: 1,
    status,
    schemaId: 'schema-1', classificationMethod: 'fingerprint', classificationConfidence: 0.9,
    invoiceNumber: '001', invoiceSymbol: null, invoiceDate: '2026-04-07',
    invoiceType: 'original', sellerName: 'Seller', sellerTaxId: '123',
    buyerName: 'Buyer', buyerTaxId: '456',
    subtotal: 1000, vatRate: 10, vatAmount: 100, total: 1100, poNumber: null,
    lineItems: [], overallConfidence: 0.85, ocrRawText: 'text',
    extractedRawJson: '{}', validationErrors: null, fieldConfidences: null,
    duplicateOf: null, createdAt: new Date(), updatedAt: new Date(),
    processedAt: new Date(), reviewedAt: new Date(), reviewedBy: 'op-1',
  });
}

describe('ReprocessInvoiceUseCase', () => {
  let useCase: ReprocessInvoiceUseCase;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;
  let jobQueue: jest.Mocked<IJobQueue>;
  let createNotification: jest.Mocked<CreateNotificationUseCase>;

  beforeEach(() => {
    invoiceRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findByBatchId: jest.fn(),
      findByFileHash: jest.fn(),
      findRecent: jest.fn(),
    } as unknown as jest.Mocked<IInvoiceRepository>;

    jobQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
      resetStaleJobs: jest.fn(),
    } as unknown as jest.Mocked<IJobQueue>;

    createNotification = {
      execute: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<CreateNotificationUseCase>;

    useCase = new ReprocessInvoiceUseCase(invoiceRepo, jobQueue, createNotification);
  });

  it('should reprocess an approved invoice — resets to pending and enqueues', async () => {
    const invoice = createMockInvoice('approved');
    invoiceRepo.findById.mockResolvedValue(invoice);

    const result = await useCase.execute({ invoiceId: 'inv-1' });

    expect(result.invoiceId).toBe('inv-1');
    expect(result.previousStatus).toBe('approved');
    expect(result.newStatus).toBe('pending');
    expect(invoiceRepo.save).toHaveBeenCalledWith(invoice);
    expect(jobQueue.enqueue).toHaveBeenCalledWith('inv-1');
    expect(createNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'info',
        relatedEntityType: 'invoice',
        relatedEntityId: 'inv-1',
      }),
    );
  });

  it('should reprocess an errored invoice', async () => {
    const invoice = createMockInvoice('error');
    invoiceRepo.findById.mockResolvedValue(invoice);

    const result = await useCase.execute({ invoiceId: 'inv-1' });

    expect(result.previousStatus).toBe('error');
    expect(result.newStatus).toBe('pending');
  });

  it('should reprocess a duplicate invoice', async () => {
    const invoice = createMockInvoice('duplicate');
    invoiceRepo.findById.mockResolvedValue(invoice);

    const result = await useCase.execute({ invoiceId: 'inv-1' });

    expect(result.previousStatus).toBe('duplicate');
    expect(result.newStatus).toBe('pending');
  });

  it('should throw when invoice not found', async () => {
    invoiceRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ invoiceId: 'nope' }))
      .rejects.toThrow('Invoice not found: nope');
  });

  it('should throw DomainError for non-reprocessable status (pending)', async () => {
    const invoice = createMockInvoice('pending');
    invoiceRepo.findById.mockResolvedValue(invoice);

    await expect(useCase.execute({ invoiceId: 'inv-1' }))
      .rejects.toThrow(DomainError);
  });

  it('should work without notification use case (optional dependency)', async () => {
    const useCaseNoNotification = new ReprocessInvoiceUseCase(invoiceRepo, jobQueue);
    const invoice = createMockInvoice('approved');
    invoiceRepo.findById.mockResolvedValue(invoice);

    const result = await useCaseNoNotification.execute({ invoiceId: 'inv-1' });

    expect(result.newStatus).toBe('pending');
    expect(jobQueue.enqueue).toHaveBeenCalledWith('inv-1');
  });

  it('should not fail if notification creation throws', async () => {
    createNotification.execute.mockRejectedValue(new Error('notification failed'));
    const invoice = createMockInvoice('approved');
    invoiceRepo.findById.mockResolvedValue(invoice);

    const result = await useCase.execute({ invoiceId: 'inv-1' });

    expect(result.newStatus).toBe('pending');
    expect(jobQueue.enqueue).toHaveBeenCalled();
  });
});
