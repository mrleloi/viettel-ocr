import { Batch } from '../batch.entity';
import { DomainError } from '../../shared/domain-error';

function createBatch(overrides?: Record<string, unknown>): Batch {
  return Batch.create({
    uploadMode: 'single_ncc',
    totalFiles: 5,
    hintSchemaId: 'schema-1',
    ...overrides,
  });
}

describe('Batch', () => {
  describe('create', () => {
    it('should create batch with valid props', () => {
      const batch = createBatch();
      expect(batch.id).toBeDefined();
      expect(batch.uploadMode).toBe('single_ncc');
      expect(batch.totalFiles).toBe(5);
      expect(batch.processedFiles).toBe(0);
      expect(batch.status).toBe('uploading');
      expect(batch.createdAt).toBeInstanceOf(Date);
    });

    it('should create mixed batch without hintSchemaId', () => {
      const batch = createBatch({ uploadMode: 'mixed', hintSchemaId: null });
      expect(batch.uploadMode).toBe('mixed');
      expect(batch.hintSchemaId).toBeNull();
    });

    it('should throw DomainError when totalFiles is 0', () => {
      expect(() => createBatch({ totalFiles: 0 })).toThrow(DomainError);
    });

    it('should throw DomainError when totalFiles is negative', () => {
      expect(() => createBatch({ totalFiles: -1 })).toThrow(DomainError);
    });

    it('should throw DomainError for invalid uploadMode', () => {
      expect(() => createBatch({ uploadMode: 'invalid' })).toThrow(DomainError);
    });

    it('should default autoCreateSchemaOnNewPattern to false', () => {
      const batch = createBatch();
      expect(batch.autoCreateSchemaOnNewPattern).toBe(false);
    });

    it('should accept autoCreateSchemaOnNewPattern = true', () => {
      const batch = Batch.create({
        uploadMode: 'single_ncc',
        totalFiles: 1,
        autoCreateSchemaOnNewPattern: true,
      });
      expect(batch.autoCreateSchemaOnNewPattern).toBe(true);
    });
  });

  describe('startProcessing', () => {
    it('should transition from uploading to processing', () => {
      const batch = createBatch();
      batch.startProcessing();
      expect(batch.status).toBe('processing');
    });

    it('should throw DomainError when not in uploading status', () => {
      const batch = createBatch();
      batch.startProcessing();
      expect(() => batch.startProcessing()).toThrow(DomainError);
    });
  });

  describe('recordFileResult', () => {
    it('should increment success count', () => {
      const batch = createBatch({ totalFiles: 3 });
      batch.startProcessing();
      batch.recordFileResult(true);
      expect(batch.processedFiles).toBe(1);
      expect(batch.successFiles).toBe(1);
      expect(batch.errorFiles).toBe(0);
    });

    it('should increment error count', () => {
      const batch = createBatch({ totalFiles: 3 });
      batch.startProcessing();
      batch.recordFileResult(false);
      expect(batch.processedFiles).toBe(1);
      expect(batch.successFiles).toBe(0);
      expect(batch.errorFiles).toBe(1);
    });

    it('should auto-complete when all files processed successfully', () => {
      const batch = createBatch({ totalFiles: 2 });
      batch.startProcessing();
      batch.recordFileResult(true);
      batch.recordFileResult(true);
      expect(batch.status).toBe('completed');
      expect(batch.completedAt).toBeInstanceOf(Date);
    });

    it('should move to partial when all files processed with some errors', () => {
      const batch = createBatch({ totalFiles: 2 });
      batch.startProcessing();
      batch.recordFileResult(true);
      batch.recordFileResult(false);
      expect(batch.status).toBe('partial');
    });

    it('should move to failed when all files errored', () => {
      const batch = createBatch({ totalFiles: 2 });
      batch.startProcessing();
      batch.recordFileResult(false);
      batch.recordFileResult(false);
      expect(batch.status).toBe('failed');
    });
  });

  describe('cancel', () => {
    it('should cancel a processing batch', () => {
      const batch = createBatch();
      batch.startProcessing();
      batch.cancel();
      expect(batch.status).toBe('cancelled');
    });

    it('should cancel an uploading batch', () => {
      const batch = createBatch();
      batch.cancel();
      expect(batch.status).toBe('cancelled');
    });

    it('should throw DomainError when already completed', () => {
      const batch = createBatch({ totalFiles: 1 });
      batch.startProcessing();
      batch.recordFileResult(true);
      expect(() => batch.cancel()).toThrow(DomainError);
    });
  });

  describe('reconstitute', () => {
    it('should recreate from stored props', () => {
      const batch = Batch.reconstitute({
        id: 'batch-1',
        uploadMode: 'mixed',
        hintSchemaId: null,
        totalFiles: 10,
        processedFiles: 8,
        successFiles: 7,
        errorFiles: 1,
        status: 'processing',
        createdAt: new Date('2026-04-07'),
        completedAt: null,
        autoCreateSchemaOnNewPattern: false,
      });
      expect(batch.id).toBe('batch-1');
      expect(batch.processedFiles).toBe(8);
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const batch = createBatch({ id: 'batch-test' });
      const props = batch.toProps();
      expect(props.id).toBe('batch-test');
      expect(props.totalFiles).toBe(5);
      expect(props.status).toBe('uploading');
    });
  });
});
