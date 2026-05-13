import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import type { ProcessInvoiceUseCase } from '../../application/processing/process-invoice.use-case';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IJobQueue } from '../../domain/shared/job-queue';
import type { QueueMetrics } from './queue-worker.service';

/**
 * BullMQ-backed worker service.
 *
 * Uses BullMQ's native Worker class which pulls jobs from Redis and dispatches
 * them to the processor callback. Concurrency, retries, backoff, and stalled-
 * job recovery are all handled by BullMQ itself.
 *
 * Provides the same observability surface as the in-memory QueueWorkerService.
 */
@Injectable()
export class BullMQWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMQWorkerService.name);
  private worker: Worker | null = null;

  // Metrics
  private completed = 0;
  private failed = 0;
  private inFlight = 0;
  private readonly recentDurations: number[] = [];
  private static readonly MAX_DURATION_SAMPLES = 200;

  constructor(
    private readonly redis: IORedis,
    private readonly queueName: string,
    private readonly prefix: string,
    private readonly concurrency: number,
    private readonly processInvoice: ProcessInvoiceUseCase,
    private readonly queue: IJobQueue,
    private readonly invoiceRepo?: IInvoiceRepository,
    private readonly enabled: boolean = true,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('BullMQ worker disabled (backend != redis)');
      return;
    }
    // Crash recovery: re-enqueue any stuck/pending invoices so BullMQ can pick them up
    if (this.invoiceRepo) {
      try {
        const orphaned = await this.invoiceRepo.findByFilters({ status: 'processing' });
        for (const inv of orphaned) {
          await this.invoiceRepo.updateStatus(inv.id, 'pending');
        }
        if (orphaned.length > 0) {
          this.logger.log(`Reset ${orphaned.length} orphaned invoice(s) from 'processing' back to 'pending'`);
        }
        const pending = await this.invoiceRepo.findByFilters({ status: 'pending' });
        let enqueued = 0;
        for (const inv of pending) {
          await this.queue.enqueue(inv.id);
          enqueued++;
        }
        if (enqueued > 0) {
          this.logger.log(`Re-enqueued ${enqueued} pending invoice(s) into BullMQ`);
        }
      } catch (err) {
        this.logger.warn(`Crash recovery failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.worker = new Worker(
      this.queueName,
      async (job: Job) => this.processJob(job),
      {
        connection: this.redis,
        prefix: this.prefix,
        concurrency: this.concurrency,
      },
    );

    this.worker.on('completed', () => {
      this.completed += 1;
    });
    this.worker.on('failed', (_job, err) => {
      this.failed += 1;
      this.logger.error(`[fail] job failed: ${err?.message ?? 'unknown'}`);
    });
    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });

    this.logger.log(
      `BullMQ worker started (queue="${this.queueName}" prefix="${this.prefix}" concurrency=${this.concurrency})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
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
      backend: 'redis',
    };
  }

  /**
   * Process a single BullMQ job. Throws on failure (BullMQ handles retry).
   */
  private async processJob(job: Job): Promise<void> {
    const start = Date.now();
    const data = job.data as { invoiceId: string };
    this.inFlight += 1;
    const jobLabel = `job=${job.id?.slice(0, 12)} inv=${data.invoiceId.slice(0, 8)} attempt=${job.attemptsMade + 1}/${job.opts.attempts ?? 3}`;

    try {
      await this.processInvoice.execute({ invoiceId: data.invoiceId });
      const durMs = Date.now() - start;
      this.recordDuration(durMs);
      this.logger.log(`[ok] ${jobLabel} dur=${durMs}ms inflight=${this.inFlight - 1}/${this.concurrency}`);
    } catch (error) {
      const durMs = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[fail] ${jobLabel} dur=${durMs}ms err="${errMsg.slice(0, 200)}"`);
      throw error; // Let BullMQ handle retry via its built-in backoff
    } finally {
      this.inFlight -= 1;
    }
  }

  /** Record a job duration, keeping only the most recent samples. */
  private recordDuration(ms: number): void {
    this.recentDurations.push(ms);
    if (this.recentDurations.length > BullMQWorkerService.MAX_DURATION_SAMPLES) {
      this.recentDurations.shift();
    }
  }
}
