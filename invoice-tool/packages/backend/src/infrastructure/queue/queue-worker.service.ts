import { Injectable, Inject, Optional, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { IJobQueue } from '../../domain/shared/job-queue';
import { ProcessInvoiceUseCase } from '../../application/processing/process-invoice.use-case';

/** Default polling interval in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 500;

/** Default max concurrent jobs per poll cycle */
const DEFAULT_BATCH_SIZE = 5;

/**
 * QueueWorkerService — polls the job queue and processes invoices.
 *
 * NestJS lifecycle-aware: starts polling on module init, stops on destroy.
 * Uses setInterval-based polling with guard against concurrent execution.
 */
@Injectable()
export class QueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    @Inject('IJobQueue') private readonly queue: IJobQueue,
    private readonly processInvoice: ProcessInvoiceUseCase,
    @Optional() @Inject('POLL_INTERVAL_MS') pollIntervalMs?: number,
    @Optional() @Inject('BATCH_SIZE') batchSize?: number,
  ) {
    this.pollIntervalMs = pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.batchSize = batchSize ?? DEFAULT_BATCH_SIZE;
  }

  /**
   * Called when the NestJS module initializes.
   * Resets stale jobs and starts polling.
   */
  async onModuleInit(): Promise<void> {
    const resetCount = await this.queue.resetStaleJobs();
    if (resetCount > 0) {
      this.logger.log(`Reset ${resetCount} stale jobs to pending`);
    }
    this.startPolling();
  }

  /**
   * Called when the NestJS module is being destroyed.
   * Stops polling gracefully.
   */
  onModuleDestroy(): void {
    this.stopPolling();
  }

  /**
   * Start the polling loop.
   */
  startPolling(): void {
    if (this.intervalRef) return; // Already polling
    this.intervalRef = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
    this.logger.log(`Queue worker started, polling every ${this.pollIntervalMs}ms`);
  }

  /**
   * Stop the polling loop.
   */
  stopPolling(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
      this.logger.log('Queue worker stopped');
    }
  }

  /**
   * Single poll cycle: take pending jobs and process them.
   * Skips if a previous poll is still in progress.
   */
  async poll(): Promise<void> {
    if (this.processing) return; // Skip if still processing previous batch
    this.processing = true;

    try {
      const jobs = await this.queue.takePending(this.batchSize);
      if (jobs.length === 0) return;

      this.logger.log(`Processing ${jobs.length} job(s)`);

      for (const job of jobs) {
        try {
          await this.processInvoice.execute({ invoiceId: job.invoiceId });
          await this.queue.markCompleted(job.id);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(`Job ${job.id} failed: ${errorMsg}`);
          await this.queue.markFailed(job.id, errorMsg);
        }
      }
    } catch (error) {
      this.logger.error(`Poll cycle error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.processing = false;
    }
  }
}
