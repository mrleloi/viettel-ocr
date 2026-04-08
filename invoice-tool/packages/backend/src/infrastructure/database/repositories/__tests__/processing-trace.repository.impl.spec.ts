import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { ProcessingTraceRepositoryImpl } from '../processing-trace.repository.impl';
import { ProcessingTrace } from '../../../../domain/processing/processing-trace.entity';
import { batches, invoices } from '../../schema';

describe('ProcessingTraceRepositoryImpl', () => {
  let db: TestDB;
  let repo: ProcessingTraceRepositoryImpl;

  beforeEach(() => {
    db = createTestDb();
    repo = new ProcessingTraceRepositoryImpl(db as never);

    const now = new Date().toISOString();

    // Insert parent batch
    db.insert(batches).values({
      id: 'batch-001',
      uploadMode: 'single_ncc',
      totalFiles: 2,
      processedFiles: 0,
      successFiles: 0,
      errorFiles: 0,
      status: 'uploading',
      createdAt: now,
    }).run();

    // Insert parent invoices
    db.insert(invoices).values({
      id: 'inv-001',
      batchId: 'batch-001',
      originalFilename: 'test.pdf',
      storagePath: '/uploads/test.pdf',
      fileHash: 'abc123',
      fileSizeBytes: 1024,
      pageCount: 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).run();

    db.insert(invoices).values({
      id: 'inv-002',
      batchId: 'batch-001',
      originalFilename: 'test2.pdf',
      storagePath: '/uploads/test2.pdf',
      fileHash: 'def456',
      fileSizeBytes: 2048,
      pageCount: 2,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).run();
  });

  describe('save()', () => {
    it('should insert a new trace', async () => {
      const trace = ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
        durationMs: 120,
      });

      await repo.save(trace);

      const found = await repo.findByInvoiceId('inv-001');
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(trace.id);
      expect(found[0].stage).toBe('classify');
      expect(found[0].status).toBe('completed');
      expect(found[0].durationMs).toBe(120);
    });

    it('should upsert on conflict', async () => {
      const trace = ProcessingTrace.create({
        id: 'trace-fixed',
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
        durationMs: 100,
      });
      await repo.save(trace);

      // Save again with updated status
      const updated = ProcessingTrace.reconstitute({
        id: 'trace-fixed',
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'failed',
        inputData: null,
        outputData: null,
        errorMessage: 'Retry needed',
        durationMs: 200,
        createdAt: trace.createdAt,
      });
      await repo.save(updated);

      const found = await repo.findByInvoiceId('inv-001');
      expect(found).toHaveLength(1);
      expect(found[0].status).toBe('failed');
      expect(found[0].errorMessage).toBe('Retry needed');
      expect(found[0].durationMs).toBe(200);
    });

    it('should save trace with all optional fields', async () => {
      const trace = ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'extract',
        status: 'completed',
        inputData: '{"pdf":"base64data"}',
        outputData: '{"fields":{"invoiceNumber":"001"}}',
        errorMessage: null,
        durationMs: 3000,
      });

      await repo.save(trace);

      const found = await repo.findByInvoiceId('inv-001');
      expect(found[0].inputData).toBe('{"pdf":"base64data"}');
      expect(found[0].outputData).toBe('{"fields":{"invoiceNumber":"001"}}');
    });
  });

  describe('findByInvoiceId()', () => {
    it('should return empty array for unknown invoice', async () => {
      const result = await repo.findByInvoiceId('nonexistent');
      expect(result).toEqual([]);
    });

    it('should return traces ordered by createdAt ASC', async () => {
      const trace1 = ProcessingTrace.reconstitute({
        id: 'trace-1',
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
        inputData: null,
        outputData: null,
        errorMessage: null,
        durationMs: 100,
        createdAt: new Date('2026-01-01T10:00:00Z'),
      });
      const trace2 = ProcessingTrace.reconstitute({
        id: 'trace-2',
        invoiceId: 'inv-001',
        stage: 'extract',
        status: 'completed',
        inputData: null,
        outputData: null,
        errorMessage: null,
        durationMs: 200,
        createdAt: new Date('2026-01-01T10:01:00Z'),
      });
      const trace3 = ProcessingTrace.reconstitute({
        id: 'trace-3',
        invoiceId: 'inv-001',
        stage: 'validate',
        status: 'completed',
        inputData: null,
        outputData: null,
        errorMessage: null,
        durationMs: 50,
        createdAt: new Date('2026-01-01T10:02:00Z'),
      });

      // Save in reverse order to verify ordering
      await repo.save(trace3);
      await repo.save(trace1);
      await repo.save(trace2);

      const found = await repo.findByInvoiceId('inv-001');
      expect(found).toHaveLength(3);
      expect(found[0].stage).toBe('classify');
      expect(found[1].stage).toBe('extract');
      expect(found[2].stage).toBe('validate');
    });

    it('should not return traces from different invoices', async () => {
      const trace1 = ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
      });
      const trace2 = ProcessingTrace.create({
        invoiceId: 'inv-002',
        stage: 'classify',
        status: 'completed',
      });

      await repo.save(trace1);
      await repo.save(trace2);

      const found1 = await repo.findByInvoiceId('inv-001');
      const found2 = await repo.findByInvoiceId('inv-002');
      expect(found1).toHaveLength(1);
      expect(found2).toHaveLength(1);
      expect(found1[0].invoiceId).toBe('inv-001');
      expect(found2[0].invoiceId).toBe('inv-002');
    });
  });
});
