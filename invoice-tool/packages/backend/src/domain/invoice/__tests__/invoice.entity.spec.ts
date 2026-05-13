import { Invoice } from '../invoice.entity';
import { DomainError } from '../../shared/domain-error';
import type { InvoiceStatus } from '@invoice-tool/shared';

function createInvoice(overrides?: Record<string, unknown>): Invoice {
  return Invoice.create({
    batchId: 'batch-1',
    originalFilename: 'test-invoice.pdf',
    storagePath: '/data/uploads/batch-1/test-invoice.pdf',
    fileHash: 'sha256-abc123def456',
    fileSizeBytes: 102400,
    pageCount: 1,
    ...overrides,
  });
}

describe('Invoice', () => {
  describe('create', () => {
    it('should create invoice with valid props', () => {
      const invoice = createInvoice();
      expect(invoice.id).toBeDefined();
      expect(invoice.status).toBe('pending');
      expect(invoice.batchId).toBe('batch-1');
      expect(invoice.originalFilename).toBe('test-invoice.pdf');
      expect(invoice.createdAt).toBeInstanceOf(Date);
    });

    it('should generate id when not provided', () => {
      const a = createInvoice();
      const b = createInvoice();
      expect(a.id).not.toBe(b.id);
    });

    it('should use provided id', () => {
      const invoice = createInvoice({ id: 'custom-id' });
      expect(invoice.id).toBe('custom-id');
    });

    it('should create with null optional fields', () => {
      const invoice = createInvoice();
      expect(invoice.schemaId).toBeNull();
      expect(invoice.invoiceNumber).toBeNull();
      expect(invoice.total).toBeNull();
      expect(invoice.overallConfidence).toBeNull();
    });

    it('should throw DomainError when originalFilename is empty', () => {
      expect(() => createInvoice({ originalFilename: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when fileHash is empty', () => {
      expect(() => createInvoice({ fileHash: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when fileSizeBytes is 0', () => {
      expect(() => createInvoice({ fileSizeBytes: 0 })).toThrow(DomainError);
    });

    it('should throw DomainError when fileSizeBytes is negative', () => {
      expect(() => createInvoice({ fileSizeBytes: -1 })).toThrow(DomainError);
    });

    it('should throw DomainError when pageCount is 0', () => {
      expect(() => createInvoice({ pageCount: 0 })).toThrow(DomainError);
    });
  });

  describe('reconstitute', () => {
    it('should recreate invoice from stored props without validation', () => {
      const invoice = Invoice.reconstitute({
        id: 'inv-123',
        batchId: 'batch-1',
        originalFilename: 'test.pdf',
        storagePath: '/path/to/test.pdf',
        fileHash: 'hash123',
        fileSizeBytes: 1024,
        pageCount: 1,
        status: 'approved',
        schemaId: 'schema-1',
        classificationMethod: 'fingerprint',
        classificationConfidence: 0.95,
        invoiceNumber: '0080321',
        invoiceSymbol: '1C26TAA',
        invoiceDate: '2026-04-07',
        invoiceType: 'original',
        sellerName: 'Digiworld',
        sellerTaxId: '0302861742',
        buyerName: 'Viettel',
        buyerTaxId: '0100109106',
        subtotal: 881900,
        vatRate: 8,
        vatAmount: 70552,
        total: 952452,
        poNumber: 'PO-2026-001',
        lineItems: [],
        overallConfidence: 0.92,
        ocrRawText: 'raw text',
        extractedRawJson: '{}',
        validationErrors: null,
        fieldConfidences: null,
        duplicateOf: null,
        createdAt: new Date('2026-04-07'),
        updatedAt: new Date('2026-04-07'),
        processedAt: new Date('2026-04-07'),
        reviewedAt: null,
        reviewedBy: null,
      });
      expect(invoice.id).toBe('inv-123');
      expect(invoice.status).toBe('approved');
    });
  });

  describe('markAsProcessing', () => {
    it('should transition from pending to processing', () => {
      const invoice = createInvoice();
      invoice.markAsProcessing();
      expect(invoice.status).toBe('processing');
    });

    it('should allow re-entering processing (crash-recovery retry)', () => {
      const invoice = createInvoice();
      invoice.markAsProcessing();
      invoice.markAsProcessing();
      expect(invoice.status).toBe('processing');
    });

    it('should throw DomainError when invoice is in a terminal status', () => {
      const invoice = createInvoice();
      invoice.markAsProcessing();
      invoice.markAsError();
      expect(() => invoice.markAsProcessing()).toThrow(DomainError);
    });
  });

  describe('setExtractedData', () => {
    it('should set extracted fields and move to extracted status', () => {
      const invoice = createInvoice();
      invoice.markAsProcessing();
      invoice.setExtractedData({
        schemaId: 'schema-1',
        classificationMethod: 'fingerprint',
        classificationConfidence: 0.95,
        invoiceNumber: '0080321',
        invoiceSymbol: '1C26TAA',
        invoiceDate: '2026-04-07',
        invoiceType: 'original',
        sellerName: 'Digiworld',
        sellerTaxId: '0302861742',
        buyerName: 'Viettel',
        buyerTaxId: '0100109106',
        subtotal: 881900,
        vatRate: 8,
        vatAmount: 70552,
        total: 952452,
        poNumber: null,
        lineItems: [{ productCode: null, name: 'Product A', unit: 'cái', quantity: 1, unitPrice: 881900, amount: 881900, vatRate: 8, vatAmount: 70552, totalWithVat: 952452 }],
        ocrRawText: 'raw text',
        extractedRawJson: '{"test": true}',
        fieldConfidences: '{"invoiceNumber": 0.99}',
      });
      expect(invoice.status).toBe('extracted');
      expect(invoice.invoiceNumber).toBe('0080321');
      expect(invoice.total).toBe(952452);
    });
  });

  describe('markAsDuplicate', () => {
    it('should mark as duplicate with reference to original', () => {
      const invoice = createInvoice();
      invoice.markAsDuplicate('inv-original-123');
      expect(invoice.status).toBe('duplicate');
      expect(invoice.duplicateOf).toBe('inv-original-123');
    });
  });

  describe('approve', () => {
    it('should approve invoice in needs_review status', () => {
      const invoice = Invoice.reconstitute({
        id: 'inv-1', batchId: 'b-1', originalFilename: 'f.pdf',
        storagePath: '/p', fileHash: 'h', fileSizeBytes: 1, pageCount: 1,
        status: 'needs_review' as InvoiceStatus,
        schemaId: null, classificationMethod: null, classificationConfidence: null,
        invoiceNumber: null, invoiceSymbol: null, invoiceDate: null, invoiceType: null,
        sellerName: null, sellerTaxId: null, buyerName: null, buyerTaxId: null,
        subtotal: null, vatRate: null, vatAmount: null, total: null, poNumber: null,
        lineItems: [], overallConfidence: null, ocrRawText: null,
        extractedRawJson: null, validationErrors: null, fieldConfidences: null,
        duplicateOf: null, createdAt: new Date(), updatedAt: new Date(),
        processedAt: null, reviewedAt: null, reviewedBy: null,
      });
      invoice.approve('operator-1');
      expect(invoice.status).toBe('approved');
      expect(invoice.reviewedBy).toBe('operator-1');
      expect(invoice.reviewedAt).toBeInstanceOf(Date);
    });

    it('should throw DomainError when not in needs_review status', () => {
      const invoice = createInvoice();
      expect(() => invoice.approve('op-1')).toThrow(DomainError);
    });
  });

  describe('reject', () => {
    it('should reject invoice in needs_review status', () => {
      const invoice = Invoice.reconstitute({
        id: 'inv-1', batchId: 'b-1', originalFilename: 'f.pdf',
        storagePath: '/p', fileHash: 'h', fileSizeBytes: 1, pageCount: 1,
        status: 'needs_review' as InvoiceStatus,
        schemaId: null, classificationMethod: null, classificationConfidence: null,
        invoiceNumber: null, invoiceSymbol: null, invoiceDate: null, invoiceType: null,
        sellerName: null, sellerTaxId: null, buyerName: null, buyerTaxId: null,
        subtotal: null, vatRate: null, vatAmount: null, total: null, poNumber: null,
        lineItems: [], overallConfidence: null, ocrRawText: null,
        extractedRawJson: null, validationErrors: null, fieldConfidences: null,
        duplicateOf: null, createdAt: new Date(), updatedAt: new Date(),
        processedAt: null, reviewedAt: null, reviewedBy: null,
      });
      invoice.reject('operator-1');
      expect(invoice.status).toBe('rejected');
    });
  });

  describe('setOverallConfidence', () => {
    it('should set confidence score', () => {
      const invoice = createInvoice();
      invoice.setOverallConfidence(0.92);
      expect(invoice.overallConfidence).toBe(0.92);
    });

    it('should throw DomainError for out of range confidence', () => {
      const invoice = createInvoice();
      expect(() => invoice.setOverallConfidence(1.5)).toThrow(DomainError);
      expect(() => invoice.setOverallConfidence(-0.1)).toThrow(DomainError);
    });
  });

  describe('resumeForReprocess', () => {
    /**
     * Helper: create invoice in a specific status via reconstitute.
     */
    function createInvoiceInStatus(status: InvoiceStatus): Invoice {
      return Invoice.reconstitute({
        id: 'inv-reprocess', batchId: 'b-1', originalFilename: 'test.pdf',
        storagePath: '/p/test.pdf', fileHash: 'hash123', fileSizeBytes: 1024, pageCount: 2,
        status,
        schemaId: 'schema-1', classificationMethod: 'fingerprint', classificationConfidence: 0.95,
        invoiceNumber: '0080321', invoiceSymbol: '1C26TAA', invoiceDate: '2026-04-07',
        invoiceType: 'original', sellerName: 'Digiworld', sellerTaxId: '0302861742',
        buyerName: 'Viettel', buyerTaxId: '0100109106',
        subtotal: 881900, vatRate: 8, vatAmount: 70552, total: 952452, poNumber: 'PO-001',
        lineItems: [{ productCode: null, name: 'Product A', unit: 'cái', quantity: 1, unitPrice: 881900, amount: 881900, vatRate: 8, vatAmount: 70552, totalWithVat: 952452 }],
        overallConfidence: 0.92, ocrRawText: 'raw text', extractedRawJson: '{"test":true}',
        validationErrors: '["err1"]', fieldConfidences: '{"invoiceNumber":0.99}',
        duplicateOf: status === 'duplicate' ? 'inv-original' : null,
        createdAt: new Date('2026-04-07'), updatedAt: new Date('2026-04-07'),
        processedAt: new Date('2026-04-07'), reviewedAt: new Date('2026-04-07'), reviewedBy: 'op-1',
      });
    }

    it('should reprocess from approved status — resets to pending and wipes data', () => {
      const invoice = createInvoiceInStatus('approved');
      invoice.resumeForReprocess();

      expect(invoice.status).toBe('pending');
      expect(invoice.schemaId).toBeNull();
      expect(invoice.classificationMethod).toBeNull();
      expect(invoice.classificationConfidence).toBeNull();
      expect(invoice.invoiceNumber).toBeNull();
      expect(invoice.invoiceSymbol).toBeNull();
      expect(invoice.invoiceDate).toBeNull();
      expect(invoice.invoiceType).toBeNull();
      expect(invoice.sellerName).toBeNull();
      expect(invoice.sellerTaxId).toBeNull();
      expect(invoice.buyerName).toBeNull();
      expect(invoice.buyerTaxId).toBeNull();
      expect(invoice.subtotal).toBeNull();
      expect(invoice.vatRate).toBeNull();
      expect(invoice.vatAmount).toBeNull();
      expect(invoice.total).toBeNull();
      expect(invoice.poNumber).toBeNull();
      expect(invoice.lineItems).toEqual([]);
      expect(invoice.overallConfidence).toBeNull();
      expect(invoice.ocrRawText).toBeNull();
      expect(invoice.extractedRawJson).toBeNull();
      expect(invoice.validationErrors).toBeNull();
      expect(invoice.fieldConfidences).toBeNull();
      expect(invoice.duplicateOf).toBeNull();
      expect(invoice.processedAt).toBeNull();
      expect(invoice.reviewedAt).toBeNull();
      expect(invoice.reviewedBy).toBeNull();
      expect(invoice.updatedAt).toBeInstanceOf(Date);
    });

    it('should reprocess from rejected status', () => {
      const invoice = createInvoiceInStatus('rejected');
      invoice.resumeForReprocess();
      expect(invoice.status).toBe('pending');
      expect(invoice.invoiceNumber).toBeNull();
    });

    it('should reprocess from error status', () => {
      const invoice = createInvoiceInStatus('error');
      invoice.resumeForReprocess();
      expect(invoice.status).toBe('pending');
    });

    it('should reprocess from duplicate status and clear duplicateOf', () => {
      const invoice = createInvoiceInStatus('duplicate');
      expect(invoice.duplicateOf).toBe('inv-original');
      invoice.resumeForReprocess();
      expect(invoice.status).toBe('pending');
      expect(invoice.duplicateOf).toBeNull();
    });

    it('should throw DomainError when reprocessing from pending', () => {
      const invoice = createInvoiceInStatus('pending');
      expect(() => invoice.resumeForReprocess()).toThrow(DomainError);
      expect(() => invoice.resumeForReprocess()).toThrow(/Cannot reprocess/);
    });

    it('should throw DomainError when reprocessing from processing', () => {
      const invoice = createInvoiceInStatus('processing');
      expect(() => invoice.resumeForReprocess()).toThrow(DomainError);
    });

    it('should allow reprocessing from needs_review', () => {
      const invoice = createInvoiceInStatus('needs_review');
      invoice.resumeForReprocess();
      expect(invoice.status).toBe('pending');
    });

    it('should throw DomainError when reprocessing from extracted', () => {
      const invoice = createInvoiceInStatus('extracted');
      expect(() => invoice.resumeForReprocess()).toThrow(DomainError);
    });

    it('should throw DomainError when reprocessing from validated', () => {
      const invoice = createInvoiceInStatus('validated');
      expect(() => invoice.resumeForReprocess()).toThrow(DomainError);
    });

    it('should allow reprocessing from mapped', () => {
      const invoice = createInvoiceInStatus('mapped');
      invoice.resumeForReprocess();
      expect(invoice.status).toBe('pending');
    });

    it('should preserve id, batchId, filename, storagePath, fileHash, fileSizeBytes, pageCount, createdAt', () => {
      const invoice = createInvoiceInStatus('approved');
      invoice.resumeForReprocess();
      expect(invoice.id).toBe('inv-reprocess');
      expect(invoice.batchId).toBe('b-1');
      expect(invoice.originalFilename).toBe('test.pdf');
      expect(invoice.storagePath).toBe('/p/test.pdf');
      expect(invoice.fileHash).toBe('hash123');
      expect(invoice.fileSizeBytes).toBe(1024);
      expect(invoice.pageCount).toBe(2);
      expect(invoice.createdAt).toEqual(new Date('2026-04-07'));
    });
  });

  describe('toProps', () => {
    it('should return plain object with all properties', () => {
      const invoice = createInvoice({ id: 'inv-test' });
      const props = invoice.toProps();
      expect(props.id).toBe('inv-test');
      expect(props.batchId).toBe('batch-1');
      expect(props.status).toBe('pending');
      expect(props.lineItems).toEqual([]);
    });
  });
});
