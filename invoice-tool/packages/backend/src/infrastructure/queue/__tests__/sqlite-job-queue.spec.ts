import { createTestDb, TestDB } from '../../database/__tests__/test-db.helper';
import { SqliteJobQueue } from '../sqlite-job-queue.service';
import * as schema from '../../database/schema';

describe('SqliteJobQueue', () => {
  let db: TestDB;
  let sut: SqliteJobQueue;

  // Helper: insert a batch + invoice to satisfy FK constraints
  const seedInvoice = (invoiceId: string) => {
    const now = new Date().toISOString();
    db.insert(schema.batches).values({
      id: 'batch-1',
      uploadMode: 'single_ncc',
      totalFiles: 1,
      status: 'processing',
      createdAt: now,
    }).onConflictDoNothing().run();

    db.insert(schema.invoices).values({
      id: invoiceId,
      batchId: 'batch-1',
      originalFilename: 'test.pdf',
      storagePath: 'uploads/batch-1/test.pdf',
      fileHash: `hash-${invoiceId}`,
      fileSizeBytes: 1024,
      pageCount: 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().run();
  };

  beforeEach(() => {
    db = createTestDb();
    sut = new SqliteJobQueue(db);
  });

  describe('enqueue', () => {
    it('should create a pending job and return its ID', async () => {
      seedInvoice('inv-1');
      const jobId = await sut.enqueue('inv-1');

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const count = await sut.countPending();
      expect(count).toBe(1);
    });

    it('should allow multiple jobs for the same invoice (reprocessing)', async () => {
      seedInvoice('inv-1');
      const id1 = await sut.enqueue('inv-1');
      const id2 = await sut.enqueue('inv-1');

      expect(id1).not.toBe(id2);
      expect(await sut.countPending()).toBe(2);
    });
  });

  describe('takePending', () => {
    it('should return empty array when no pending jobs', async () => {
      const jobs = await sut.takePending(5);
      expect(jobs).toEqual([]);
    });

    it('should take up to limit pending jobs and mark them processing', async () => {
      seedInvoice('inv-1');
      seedInvoice('inv-2');
      seedInvoice('inv-3');
      await sut.enqueue('inv-1');
      await sut.enqueue('inv-2');
      await sut.enqueue('inv-3');

      const jobs = await sut.takePending(2);
      expect(jobs).toHaveLength(2);
      expect(jobs[0].status).toBe('processing');
      expect(jobs[1].status).toBe('processing');
      expect(jobs[0].startedAt).not.toBeNull();

      // Only 1 should remain pending
      expect(await sut.countPending()).toBe(1);
    });

    it('should return empty array when limit is 0', async () => {
      seedInvoice('inv-1');
      await sut.enqueue('inv-1');

      const jobs = await sut.takePending(0);
      expect(jobs).toEqual([]);
      expect(await sut.countPending()).toBe(1);
    });

    it('should not return already-processing or completed jobs', async () => {
      seedInvoice('inv-1');
      seedInvoice('inv-2');
      const id1 = await sut.enqueue('inv-1');
      await sut.enqueue('inv-2');

      // Take first job
      await sut.takePending(1);
      // Mark it completed
      await sut.markCompleted(id1);

      // Only inv-2 should be takeable
      const jobs = await sut.takePending(5);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].invoiceId).toBe('inv-2');
    });
  });

  describe('markCompleted', () => {
    it('should set status to completed and set completedAt', async () => {
      seedInvoice('inv-1');
      const jobId = await sut.enqueue('inv-1');
      await sut.takePending(1);

      await sut.markCompleted(jobId);

      const jobs = await sut.takePending(10);
      expect(jobs).toHaveLength(0);
      expect(await sut.countPending()).toBe(0);
    });

    it('should throw when job not found', async () => {
      await expect(sut.markCompleted('nonexistent')).rejects.toThrow();
    });
  });

  describe('markFailed', () => {
    it('should reset to pending when attempts < maxAttempts', async () => {
      seedInvoice('inv-1');
      const jobId = await sut.enqueue('inv-1');
      await sut.takePending(1);

      await sut.markFailed(jobId, 'OCR timeout');

      // Should be back in pending (attempt 1 of 3)
      expect(await sut.countPending()).toBe(1);

      const jobs = await sut.takePending(1);
      expect(jobs[0].attempts).toBe(1);
      expect(jobs[0].lastError).toBe('OCR timeout');
    });

    it('should set status to failed when attempts >= maxAttempts', async () => {
      seedInvoice('inv-1');
      const jobId = await sut.enqueue('inv-1');

      // Fail 3 times (maxAttempts = 3)
      for (let i = 0; i < 3; i++) {
        await sut.takePending(1);
        await sut.markFailed(jobId, `Attempt ${i + 1} failed`);
      }

      // Should be permanently failed, not pending
      expect(await sut.countPending()).toBe(0);
    });

    it('should store the last error message', async () => {
      seedInvoice('inv-1');
      const jobId = await sut.enqueue('inv-1');
      await sut.takePending(1);
      await sut.markFailed(jobId, 'First error');

      const jobs = await sut.takePending(1);
      expect(jobs[0].lastError).toBe('First error');
    });
  });

  describe('resetStaleJobs', () => {
    it('should reset processing jobs to pending', async () => {
      seedInvoice('inv-1');
      seedInvoice('inv-2');
      await sut.enqueue('inv-1');
      await sut.enqueue('inv-2');
      await sut.takePending(2); // Both now processing

      const resetCount = await sut.resetStaleJobs();
      expect(resetCount).toBe(2);
      expect(await sut.countPending()).toBe(2);
    });

    it('should return 0 when no stale jobs exist', async () => {
      const resetCount = await sut.resetStaleJobs();
      expect(resetCount).toBe(0);
    });

    it('should not affect completed or failed jobs', async () => {
      seedInvoice('inv-1');
      seedInvoice('inv-2');
      const id1 = await sut.enqueue('inv-1');
      await sut.enqueue('inv-2');

      await sut.takePending(2);
      await sut.markCompleted(id1);
      // inv-2 is still processing

      const resetCount = await sut.resetStaleJobs();
      expect(resetCount).toBe(1);
      expect(await sut.countPending()).toBe(1);
    });
  });

  describe('countPending', () => {
    it('should return 0 for empty queue', async () => {
      expect(await sut.countPending()).toBe(0);
    });

    it('should count only pending jobs', async () => {
      seedInvoice('inv-1');
      seedInvoice('inv-2');
      seedInvoice('inv-3');
      await sut.enqueue('inv-1');
      await sut.enqueue('inv-2');
      await sut.enqueue('inv-3');

      await sut.takePending(1); // 1 processing, 2 pending
      expect(await sut.countPending()).toBe(2);
    });
  });
});
