import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { InvoiceRepositoryImpl } from '../invoice.repository.impl';
import { BatchRepositoryImpl } from '../batch.repository.impl';
import { SchemaRepositoryImpl } from '../schema.repository.impl';
import { Invoice } from '../../../../domain/invoice/invoice.entity';
import { Batch } from '../../../../domain/batch/batch.entity';
import { Schema } from '../../../../domain/schema/schema.entity';

describe('InvoiceRepositoryImpl', () => {
  let db: TestDB;
  let repo: InvoiceRepositoryImpl;
  let batchRepo: BatchRepositoryImpl;

  beforeEach(async () => {
    db = createTestDb();
    repo = new InvoiceRepositoryImpl(db);
    batchRepo = new BatchRepositoryImpl(db);

    // Create parent schema for FK reference (needed when invoice has schemaId)
    const schemaRepo = new SchemaRepositoryImpl(db);
    const schema = Schema.create({
      id: 'schema-1',
      name: 'Test Schema',
      nccName: 'Supplier',
      nccTaxId: '0123456789',
    });
    await schemaRepo.save(schema);

    // Create parent batch for FK reference
    const batch = Batch.create({
      id: 'batch-1',
      uploadMode: 'single_ncc',
      totalFiles: 10,
    });
    await batchRepo.save(batch);
  });

  describe('save + findById roundtrip', () => {
    it('should save and retrieve an invoice', async () => {
      const invoice = Invoice.create({
        id: 'inv-1',
        batchId: 'batch-1',
        originalFilename: 'invoice.pdf',
        storagePath: '/data/uploads/inv-1.pdf',
        fileHash: 'abc123hash',
        fileSizeBytes: 1024000,
        pageCount: 2,
      });

      await repo.save(invoice);
      const found = await repo.findById('inv-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('inv-1');
      expect(found!.batchId).toBe('batch-1');
      expect(found!.originalFilename).toBe('invoice.pdf');
      expect(found!.storagePath).toBe('/data/uploads/inv-1.pdf');
      expect(found!.fileHash).toBe('abc123hash');
      expect(found!.fileSizeBytes).toBe(1024000);
      expect(found!.pageCount).toBe(2);
      expect(found!.status).toBe('pending');
      expect(found!.schemaId).toBeNull();
      expect(found!.lineItems).toEqual([]);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findById returns null when not found', () => {
    it('should return null for non-existent ID', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByBatchId', () => {
    it('should find all invoices in a batch', async () => {
      await repo.save(Invoice.create({
        id: 'inv-a', batchId: 'batch-1', originalFilename: 'a.pdf',
        storagePath: '/a.pdf', fileHash: 'hash-a', fileSizeBytes: 100, pageCount: 1,
      }));
      await repo.save(Invoice.create({
        id: 'inv-b', batchId: 'batch-1', originalFilename: 'b.pdf',
        storagePath: '/b.pdf', fileHash: 'hash-b', fileSizeBytes: 200, pageCount: 1,
      }));

      const results = await repo.findByBatchId('batch-1');
      expect(results).toHaveLength(2);
    });
  });

  describe('findByFileHash', () => {
    it('should find invoice by file hash', async () => {
      await repo.save(Invoice.create({
        id: 'inv-hash', batchId: 'batch-1', originalFilename: 'dup.pdf',
        storagePath: '/dup.pdf', fileHash: 'unique-hash-xyz', fileSizeBytes: 500, pageCount: 1,
      }));

      const found = await repo.findByFileHash('unique-hash-xyz');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('inv-hash');
    });

    it('should return null for non-existent hash', async () => {
      const found = await repo.findByFileHash('no-such-hash');
      expect(found).toBeNull();
    });
  });

  describe('findDuplicate', () => {
    it('should find logical duplicate by symbol + number + sellerTaxId', async () => {
      const invoice = Invoice.create({
        id: 'inv-dup', batchId: 'batch-1', originalFilename: 'dup.pdf',
        storagePath: '/dup.pdf', fileHash: 'hash-dup', fileSizeBytes: 300, pageCount: 1,
      });
      invoice.setExtractedData({
        schemaId: 'schema-1',
        classificationMethod: 'fingerprint',
        classificationConfidence: 0.9,
        invoiceNumber: 'INV-001',
        invoiceSymbol: 'AB/23E',
        invoiceDate: '2024-01-15',
        invoiceType: 'original',
        sellerName: 'Supplier Co',
        sellerTaxId: '0123456789',
        buyerName: 'Buyer Co',
        buyerTaxId: '9876543210',
        subtotal: 1000000,
        vatRate: 0.1,
        vatAmount: 100000,
        total: 1100000,
        poNumber: 'PO-123',
        lineItems: [],
        ocrRawText: 'raw text',
        extractedRawJson: '{"test": true}',
        fieldConfidences: '{"invoiceNumber": 0.95}',
      });
      await repo.save(invoice);

      const found = await repo.findDuplicate('AB/23E', 'INV-001', '0123456789');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('inv-dup');
    });

    it('should return null when no duplicate exists', async () => {
      const found = await repo.findDuplicate('XX/99Z', 'INV-999', '0000000000');
      expect(found).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update only the status field', async () => {
      const invoice = Invoice.create({
        id: 'inv-status', batchId: 'batch-1', originalFilename: 's.pdf',
        storagePath: '/s.pdf', fileHash: 'hash-s', fileSizeBytes: 100, pageCount: 1,
      });
      await repo.save(invoice);

      await repo.updateStatus('inv-status', 'processing');

      const found = await repo.findById('inv-status');
      expect(found!.status).toBe('processing');
    });
  });

  describe('JSON lineItems serialization', () => {
    it('should serialize and deserialize lineItems correctly', async () => {
      const invoice = Invoice.create({
        id: 'inv-json', batchId: 'batch-1', originalFilename: 'j.pdf',
        storagePath: '/j.pdf', fileHash: 'hash-j', fileSizeBytes: 100, pageCount: 1,
      });
      invoice.setExtractedData({
        schemaId: 'schema-1',
        classificationMethod: 'llm',
        classificationConfidence: 0.85,
        invoiceNumber: 'J-001',
        invoiceSymbol: null,
        invoiceDate: null,
        invoiceType: null,
        sellerName: null,
        sellerTaxId: null,
        buyerName: null,
        buyerTaxId: null,
        subtotal: null,
        vatRate: null,
        vatAmount: null,
        total: null,
        poNumber: null,
        lineItems: [
          { name: 'Cáp quang', unit: 'Sợi', quantity: 10, unitPrice: 50000, amount: 500000, vatRate: 0.1, vatAmount: 50000, totalWithVat: 550000 },
          { name: 'Switch', unit: 'Cái', quantity: 2, unitPrice: 2000000, amount: 4000000, vatRate: 0.1, vatAmount: 400000, totalWithVat: 4400000 },
        ],
        ocrRawText: null,
        extractedRawJson: null,
        fieldConfidences: null,
      });
      await repo.save(invoice);

      const found = await repo.findById('inv-json');
      expect(found!.lineItems).toHaveLength(2);
      expect(found!.lineItems[0].name).toBe('Cáp quang');
      expect(found!.lineItems[0].quantity).toBe(10);
      expect(found!.lineItems[1].name).toBe('Switch');
      expect(found!.lineItems[1].amount).toBe(4000000);
    });
  });

  describe('upsert', () => {
    it('should update invoice on re-save', async () => {
      const invoice = Invoice.create({
        id: 'inv-up', batchId: 'batch-1', originalFilename: 'u.pdf',
        storagePath: '/u.pdf', fileHash: 'hash-u', fileSizeBytes: 100, pageCount: 1,
      });
      await repo.save(invoice);

      invoice.markAsProcessing();
      await repo.save(invoice);

      const found = await repo.findById('inv-up');
      expect(found!.status).toBe('processing');
    });
  });
});
