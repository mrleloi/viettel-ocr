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

    it('should throw DomainError when not in pending status', () => {
      const invoice = createInvoice();
      invoice.markAsProcessing();
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
        lineItems: [{ name: 'Product A', unit: 'cái', quantity: 1, unitPrice: 881900, amount: 881900, vatRate: 8, vatAmount: 70552, totalWithVat: 952452 }],
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
