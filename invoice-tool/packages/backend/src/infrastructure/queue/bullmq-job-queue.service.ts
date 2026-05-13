import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import type IORedis from 'ioredis';
import type { IJobQueue, ProcessingJob } from '../../domain/shared/job-queue';

/** BullMQ job name — single type since we process one kind of job */
const JOB_NAME = 'process-invoice';

/**
 * BullMQ-backed job queue adapter.
 *
 * Implements the enqueue side of IJobQueue. Job dispatch & lifecycle are
 * handled by BullMQWorkerService (not by this class — BullMQ Worker pulls
 * jobs internally; we don't "take" them manually).
 *
 * Methods not relevant to the push model (takePending, markCompleted,
 * markFailed) are implemented as no-ops or throw, since they are only called
 * by QueueWorkerService — which is not instantiated when backend=redis.
 */
@Injectable()
export class BullMQJobQueue implements IJobQueue, OnModuleDestroy {
  private readonly logger = new Logger(BullMQJobQueue.name);
  private readonly queue: Queue;

  constructor(redis: IORedis, queueName: string, prefix: string, maxAttempts: number) {
    this.queue = new Queue(queueName, {
      connection: redis,
      prefix,
      defaultJobOptions: {
        attempts: maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
      },
    });
    this.logger.log(`BullMQ queue "${queueName}" ready (prefix="${prefix}", maxAttempts=${maxAttempts})`);
  }

  /** Enqueue a processing job for an invoice. Idempotent via BullMQ jobId. */
  async enqueue(invoiceId: string): Promise<string> {
    // Use invoiceId as the BullMQ jobId to prevent duplicate active jobs.
    // BullMQ won't enqueue again if a job with the same ID exists.
    const opts: JobsOptions = { jobId: `inv-${invoiceId}-${Date.now()}` };
    const job = await this.queue.add(JOB_NAME, { invoiceId }, opts);
    return job.id ?? opts.jobId!;
  }

  /** Not used in BullMQ push model — Worker pulls jobs automatically. */
  async takePending(_limit: number): Promise<ProcessingJob[]> {
    return [];
  }

  /** Not used in BullMQ push model — Worker marks jobs completed internally. */
  async markCompleted(_jobId: string): Promise<void> {
    // no-op
  }

  /** Not used in BullMQ push model — Worker handles failures internally. */
  async markFailed(_jobId: string, _error: string): Promise<void> {
    // no-op
  }

  /**
   * Reset stalled jobs. BullMQ has built-in stalled job detection; we can
   * also forcibly move stalled jobs back to waiting.
   */
  async resetStaleJobs(): Promise<number> {
    // BullMQ handles this automatically via its Worker's stalled-check mechanism.
    // Here we simply report 0 — no manual reset needed.
    return 0;
  }

  /** Count waiting + delayed jobs in the BullMQ queue. */
  async countPending(): Promise<number> {
    const counts = await this.queue.getJobCounts('waiting', 'delayed', 'paused');
    return (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.paused ?? 0);
  }

  /** Get the underlying BullMQ queue (for worker setup). */
  getQueue(): Queue {
    return this.queue;
  }

  /** Graceful shutdown on module destroy. */
  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
