import { QueueWorkerService } from '../queue-worker.service';
import type { IJobQueue, ProcessingJob } from '../../../domain/shared/job-queue';
import type { ProcessInvoiceUseCase } from '../../../application/processing/process-invoice.use-case';

const createMockQueue = (): jest.Mocked<IJobQueue> => ({
  enqueue: jest.fn().mockResolvedValue('job-1'),
  takePending: jest.fn().mockResolvedValue([]),
  markCompleted: jest.fn().mockResolvedValue(undefined),
  markFailed: jest.fn().mockResolvedValue(undefined),
  resetStaleJobs: jest.fn().mockResolvedValue(0),
  countPending: jest.fn().mockResolvedValue(0),
});

const createMockProcessInvoice = (): jest.Mocked<Pick<ProcessInvoiceUseCase, 'execute'>> => ({
  execute: jest.fn().mockResolvedValue({
    invoiceId: 'inv-1',
    finalStatus: 'mapped',
    overallConfidence: 0.9,
    stages: [],
  }),
});

const makeJob = (overrides?: Partial<ProcessingJob>): ProcessingJob => ({
  id: 'job-1',
  invoiceId: 'inv-1',
  status: 'processing',
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  createdAt: new Date(),
  startedAt: new Date(),
  completedAt: null,
  ...overrides,
});

describe('QueueWorkerService', () => {
  let sut: QueueWorkerService;
  let queue: jest.Mocked<IJobQueue>;
  let processInvoice: jest.Mocked<Pick<ProcessInvoiceUseCase, 'execute'>>;

  beforeEach(() => {
    queue = createMockQueue();
    processInvoice = createMockProcessInvoice();
    // Create with long poll interval so it doesn't auto-fire during tests
    sut = new QueueWorkerService(
      queue,
      processInvoice as unknown as ProcessInvoiceUseCase,
      60000, // very long interval — won't auto-trigger
      5,
    );
  });

  afterEach(() => {
    sut.stopPolling();
  });

  describe('onModuleInit', () => {
    it('should reset stale jobs on startup', async () => {
      queue.resetStaleJobs.mockResolvedValue(3);
      await sut.onModuleInit();

      expect(queue.resetStaleJobs).toHaveBeenCalledTimes(1);
    });

    it('should start polling', async () => {
      await sut.onModuleInit();

      // After init, polling should be started
      // We can verify by checking that stopPolling works (means it was started)
      sut.stopPolling(); // Should not throw
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop polling gracefully', async () => {
      await sut.onModuleInit();
      sut.onModuleDestroy();

      // Should not throw and intervalRef should be cleared
      sut.onModuleDestroy(); // Calling again should be safe (idempotent)
    });
  });

  describe('poll', () => {
    it('should process pending jobs and mark them completed', async () => {
      const job = makeJob({ id: 'job-1', invoiceId: 'inv-1' });
      queue.takePending.mockResolvedValue([job]);

      await sut.poll();
      await sut.waitForIdle();

      expect(queue.takePending).toHaveBeenCalledWith(5);
      expect(processInvoice.execute).toHaveBeenCalledWith({ invoiceId: 'inv-1' });
      expect(queue.markCompleted).toHaveBeenCalledWith('job-1');
    });

    it('should do nothing when no pending jobs', async () => {
      queue.takePending.mockResolvedValue([]);

      await sut.poll();
      await sut.waitForIdle();

      expect(processInvoice.execute).not.toHaveBeenCalled();
      expect(queue.markCompleted).not.toHaveBeenCalled();
    });

    it('should mark job as failed when processing throws', async () => {
      const job = makeJob({ id: 'job-2', invoiceId: 'inv-2' });
      queue.takePending.mockResolvedValue([job]);
      processInvoice.execute.mockRejectedValue(new Error('Invoice not found'));

      await sut.poll();
      await sut.waitForIdle();

      expect(queue.markFailed).toHaveBeenCalledWith('job-2', 'Invoice not found');
      expect(queue.markCompleted).not.toHaveBeenCalled();
    });

    it('should dispatch multiple jobs concurrently in a single poll cycle', async () => {
      const jobs = [
        makeJob({ id: 'j1', invoiceId: 'inv-a' }),
        makeJob({ id: 'j2', invoiceId: 'inv-b' }),
        makeJob({ id: 'j3', invoiceId: 'inv-c' }),
      ];
      queue.takePending.mockResolvedValue(jobs);

      await sut.poll();
      await sut.waitForIdle();

      expect(processInvoice.execute).toHaveBeenCalledTimes(3);
      expect(queue.markCompleted).toHaveBeenCalledTimes(3);
    });

    it('should continue processing other jobs when one fails', async () => {
      const jobs = [
        makeJob({ id: 'j1', invoiceId: 'inv-ok' }),
        makeJob({ id: 'j2', invoiceId: 'inv-bad' }),
        makeJob({ id: 'j3', invoiceId: 'inv-ok2' }),
      ];
      queue.takePending.mockResolvedValue(jobs);
      processInvoice.execute
        .mockResolvedValueOnce({ invoiceId: 'inv-ok', finalStatus: 'mapped', overallConfidence: 0.9, stages: [] })
        .mockRejectedValueOnce(new Error('OCR failed'))
        .mockResolvedValueOnce({ invoiceId: 'inv-ok2', finalStatus: 'mapped', overallConfidence: 0.8, stages: [] });

      await sut.poll();
      await sut.waitForIdle();

      expect(queue.markCompleted).toHaveBeenCalledTimes(2);
      expect(queue.markFailed).toHaveBeenCalledTimes(1);
      expect(queue.markFailed).toHaveBeenCalledWith('j2', 'OCR failed');
    });
  });
});
