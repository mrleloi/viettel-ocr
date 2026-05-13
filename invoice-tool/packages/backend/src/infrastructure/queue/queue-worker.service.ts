import { Injectable, Inject, Optional, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { IJobQueue, ProcessingJob } from '../../domain/shared/job-queue';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import { ProcessInvoiceUseCase } from '../../application/processing/process-invoice.use-case';

/** Default polling interval in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 500;

/** Default max parallel jobs in flight */
const DEFAULT_CONCURRENCY = 8;

/**
 * Metrics snapshot for observability.
 */
export interface QueueMetrics {
  /** Jobs currently running */
  readonly inFlight: number;
  /** Total jobs completed since start */
  readonly completed: number;
  /** Total jobs failed since start */
  readonly failed: number;
  /** Concurrency limit */
  readonly concurrency: number;
  /** Rolling p50 job duration in ms */
  readonly p50DurationMs: number;
  /** Rolling p95 job duration in ms */
  readonly p95DurationMs: number;
  /** Worker backend type */
  readonly backend: string;
}

/**
 * QueueWorkerService — polls the job queue and processes invoices CONCURRENTLY.
 *
 * Runs up to `concurrency` jobs in parallel. When a slot frees up, the next
 * poll cycle immediately claims another job. Jobs are fire-and-forget from
 * the poll cycle — the worker does not wait for batch completion.
 *
 * Provides structured tracing per job and rolling latency metrics.
 *
 * NestJS lifecycle-aware: starts polling on module init, stops on destroy.
 */
@Injectable()
export class QueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  private readonly pollIntervalMs: number;
  private readonly concurrency: number;

  // Runtime state
  private inFlight = 0;
  private completed = 0;
  private failed = 0;
  private readonly recentDurations: number[] = [];
  private static readonly MAX_DURATION_SAMPLES = 200;

  private readonly enabled: boolean;

  constructor(
    @Inject('IJobQueue') private readonly queue: IJobQueue,
    private readonly processInvoice: ProcessInvoiceUseCase,
    @Optional() @Inject('POLL_INTERVAL_MS') pollIntervalMs?: number,
    @Optional() @Inject('QUEUE_CONCURRENCY') concurrency?: number,
    @Optional() @Inject('IInvoiceRepository') private readonly invoiceRepo?: IInvoiceRepository,
    enabled = true,
  ) {
    this.pollIntervalMs = pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.concurrency = concurrency ?? DEFAULT_CONCURRENCY;
    this.enabled = enabled;
  }

  /**
   * Called when the NestJS module initializes.
   * Resets stale jobs + orphaned invoices stuck in 'processing', then starts polling.
   */
  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('In-memory queue worker disabled (backend != memory)');
      return;
    }
    const resetCount = await this.queue.resetStaleJobs();
    if (resetCount > 0) {
      this.logger.log(`Reset ${resetCount} stale jobs to pending`);
    }

    // Crash recovery: reset invoices stuck in 'processing' status back to 'pending',
    // then ensure every 'pending' invoice has a queue job so the worker picks it up.
    if (this.invoiceRepo) {
      try {
        const orphaned = await this.invoiceRepo.findByFilters({ status: 'processing' });
        for (const inv of orphaned) {
          await this.invoiceRepo.updateStatus(inv.id, 'pending');
        }
        if (orphaned.length > 0) {
          this.logger.log(`Reset ${orphaned.length} orphaned invoice(s) from 'processing' back to 'pending'`);
        }

        // Re-enqueue any 'pending' invoice (orphaned ones plus any that lost their job)
        const pendingInvoices = await this.invoiceRepo.findByFilters({ status: 'pending' });
        let enqueuedCount = 0;
        for (const inv of pendingInvoices) {
          await this.queue.enqueue(inv.id);
          enqueuedCount++;
        }
        if (enqueuedCount > 0) {
          this.logger.log(`Re-enqueued ${enqueuedCount} pending invoice(s) for processing`);
        }
      } catch (err) {
        this.logger.warn(`Failed to recover stuck invoices: ${err instanceof Error ? err.message : String(err)}`);
      }
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
    this.logger.log(
      `Queue worker started (backend=memory concurrency=${this.concurrency} poll=${this.pollIntervalMs}ms)`,
    );
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
   * Wait until all in-flight jobs have completed.
   * Primarily used in tests; production code doesn't need to call this.
   * @param timeoutMs - Max wait time before giving up (default 30s)
   */
  async waitForIdle(timeoutMs = 30_000): Promise<void> {
    const start = Date.now();
    while (this.inFlight > 0) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`waitForIdle timeout: ${this.inFlight} jobs still in flight`);
      }
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  /**
   * Get current metrics snapshot.
   */
  getMetrics(): QueueMetrics {
    const sorted = [...this.recentDurations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    return {
      inFlight: this.inFlight,
      completed: this.completed,
      failed: this.failed,
      concurrency: this.concurrency,
      p50DurationMs: p50,
      p95DurationMs: p95,
      backend: 'memory',
    };
  }

  /**
   * Single poll cycle: claim up to (concurrency - inFlight) jobs and dispatch
   * them concurrently. Returns immediately; job completion is handled async.
   */
  async poll(): Promise<void> {
    if (this.pollInFlight) return; // Prevent reentrant polling
    this.pollInFlight = true;

    try {
      const slotsAvailable = this.concurrency - this.inFlight;
      if (slotsAvailable <= 0) return; // At capacity

      const jobs = await this.queue.takePending(slotsAvailable);
      if (jobs.length === 0) return;

      // Fire-and-forget dispatch. Each job runs concurrently.
      for (const job of jobs) {
        this.inFlight += 1;
        void this.processJob(job).finally(() => {
          this.inFlight -= 1;
        });
      }
    } catch (error) {
      this.logger.error(`Poll cycle error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.pollInFlight = false;
    }
  }

  /**
   * Process a single job. Records duration and updates metrics.
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    const start = Date.now();
    const jobLabel = `job=${job.id.slice(0, 8)} inv=${job.invoiceId.slice(0, 8)} attempt=${job.attempts + 1}/${job.maxAttempts}`;

    try {
      await this.processInvoice.execute({ invoiceId: job.invoiceId });
      await this.queue.markCompleted(job.id);
      const durMs = Date.now() - start;
      this.recordDuration(durMs);
      this.completed += 1;
      this.logger.log(`[ok] ${jobLabel} dur=${durMs}ms inflight=${this.inFlight - 1}/${this.concurrency}`);
    } catch (error) {
      const durMs = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.queue.markFailed(job.id, errMsg);
      this.failed += 1;
      this.logger.error(`[fail] ${jobLabel} dur=${durMs}ms err="${errMsg.slice(0, 200)}"`);
    }
  }

  /** Record a job duration, keeping only the most recent samples. */
  private recordDuration(ms: number): void {
    this.recentDurations.push(ms);
    if (this.recentDurations.length > QueueWorkerService.MAX_DURATION_SAMPLES) {
      this.recentDurations.shift();
    }
  }
}
