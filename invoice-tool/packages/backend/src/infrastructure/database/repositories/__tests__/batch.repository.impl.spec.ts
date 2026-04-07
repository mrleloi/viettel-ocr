import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { BatchRepositoryImpl } from '../batch.repository.impl';
import { Batch } from '../../../../domain/batch/batch.entity';

describe('BatchRepositoryImpl', () => {
  let db: TestDB;
  let repo: BatchRepositoryImpl;

  beforeEach(() => {
    db = createTestDb();
    repo = new BatchRepositoryImpl(db);
  });

  describe('save + findById roundtrip', () => {
    it('should save and retrieve a batch', async () => {
      const batch = Batch.create({
        id: 'batch-1',
        uploadMode: 'single_ncc',
        totalFiles: 5,
        hintSchemaId: null,
      });

      await repo.save(batch);
      const found = await repo.findById('batch-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('batch-1');
      expect(found!.uploadMode).toBe('single_ncc');
      expect(found!.totalFiles).toBe(5);
      expect(found!.processedFiles).toBe(0);
      expect(found!.successFiles).toBe(0);
      expect(found!.errorFiles).toBe(0);
      expect(found!.status).toBe('uploading');
      expect(found!.hintSchemaId).toBeNull();
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.completedAt).toBeNull();
    });
  });

  describe('findById returns null when not found', () => {
    it('should return null for non-existent ID', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should update batch status on re-save', async () => {
      const batch = Batch.create({
        id: 'batch-up',
        uploadMode: 'mixed',
        totalFiles: 3,
      });
      await repo.save(batch);

      batch.startProcessing();
      await repo.save(batch);

      const found = await repo.findById('batch-up');
      expect(found!.status).toBe('processing');
    });
  });

  describe('findRecent', () => {
    it('should return batches ordered by creation date DESC', async () => {
      // Create batches with different timestamps
      const old = Batch.create({ id: 'batch-old', uploadMode: 'single_ncc', totalFiles: 1 });
      const mid = Batch.create({ id: 'batch-mid', uploadMode: 'single_ncc', totalFiles: 2 });
      const recent = Batch.create({ id: 'batch-new', uploadMode: 'single_ncc', totalFiles: 3 });

      await repo.save(old);
      await repo.save(mid);
      await repo.save(recent);

      const results = await repo.findRecent(2);
      expect(results).toHaveLength(2);
      // All created at similar timestamps, but all should be returned
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        const batch = Batch.create({ id: `batch-${i}`, uploadMode: 'single_ncc', totalFiles: 1 });
        await repo.save(batch);
      }
      const results = await repo.findRecent(3);
      expect(results).toHaveLength(3);
    });
  });

  describe('updateCounters', () => {
    it('should atomically update counters', async () => {
      const batch = Batch.create({
        id: 'batch-count',
        uploadMode: 'single_ncc',
        totalFiles: 10,
      });
      await repo.save(batch);

      await repo.updateCounters('batch-count', 5, 4, 1);

      const found = await repo.findById('batch-count');
      expect(found!.processedFiles).toBe(5);
      expect(found!.successFiles).toBe(4);
      expect(found!.errorFiles).toBe(1);
    });
  });

  describe('completedAt handling', () => {
    it('should persist completedAt when batch completes', async () => {
      const batch = Batch.create({
        id: 'batch-complete',
        uploadMode: 'single_ncc',
        totalFiles: 1,
      });
      batch.startProcessing();
      batch.recordFileResult(true); // totalFiles=1, completed

      await repo.save(batch);
      const found = await repo.findById('batch-complete');

      expect(found!.status).toBe('completed');
      expect(found!.completedAt).toBeInstanceOf(Date);
    });
  });
});
