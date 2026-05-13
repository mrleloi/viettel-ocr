import { Injectable, Inject } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { DATABASE_TOKEN } from '../database/connection';
import { processingJobs } from '../database/schema';
import type { IJobQueue, ProcessingJob } from '../../domain/shared/job-queue';
import { generateId } from '../../domain/shared/identifier';

/**
 * SQLite-backed in-process job queue.
 *
 * Uses the processing_jobs table via Drizzle ORM.
 * No external dependencies (no Redis, no BullMQ).
 * Worker polls this queue to pick up jobs.
 */
@Injectable()
export class SqliteJobQueue implements IJobQueue {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Inject(DATABASE_TOKEN) private readonly db: BetterSQLite3Database<any>,
  ) {}

  /**
   * Add a job to the queue for an invoice.
   * @param invoiceId - Invoice ID to process
   * @returns Created job ID
   */
  async enqueue(invoiceId: string): Promise<string> {
    // Idempotent: if an active (pending/processing) job already exists for this
    // invoice, return its ID instead of creating a duplicate. Prevents double
    // processing when enqueue is called from both upload and crash-recovery paths.
    const existing = this.db
      .select()
      .from(processingJobs)
      .where(and(
        eq(processingJobs.invoiceId, invoiceId),
        inArray(processingJobs.status, ['pending', 'processing']),
      ))
      .get();
    if (existing) return existing.id;

    const id = generateId();
    const now = new Date().toISOString();

    this.db.insert(processingJobs).values({
      id,
      invoiceId,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    }).run();

    return id;
  }

  /**
   * Atomically claim up to `limit` pending jobs.
   * @param limit - Maximum number of jobs to take
   * @returns Array of jobs now in 'processing' status
   */
  async takePending(limit: number): Promise<ProcessingJob[]> {
    if (limit <= 0) return [];

    const now = new Date().toISOString();

    // Select pending jobs (oldest first)
    const pendingRows = this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.status, 'pending'))
      .limit(limit)
      .all();

    if (pendingRows.length === 0) return [];

    const ids = pendingRows.map(r => r.id);

    // Update them to processing atomically
    for (const id of ids) {
      this.db.update(processingJobs)
        .set({ status: 'processing', startedAt: now })
        .where(eq(processingJobs.id, id))
        .run();
    }

    // Return updated rows
    return pendingRows.map(row => this.toProcessingJob({
      ...row,
      status: 'processing',
      startedAt: now,
    }));
  }

  /**
   * Mark a job as successfully completed.
   * @param jobId - Job ID
   */
  async markCompleted(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db.update(processingJobs)
      .set({ status: 'completed', completedAt: now })
      .where(eq(processingJobs.id, jobId))
      .run();

    if (result.changes === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
  }

  /**
   * Mark a job as failed. Retries if attempts < maxAttempts.
   * @param jobId - Job ID
   * @param error - Error message
   */
  async markFailed(jobId: string, error: string): Promise<void> {
    // Get current job data
    const rows = this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId))
      .all();

    if (rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = rows[0];
    const newAttempts = job.attempts + 1;
    const isFinalFailure = newAttempts >= job.maxAttempts;

    this.db.update(processingJobs)
      .set({
        attempts: newAttempts,
        lastError: error,
        status: isFinalFailure ? 'failed' : 'pending',
        startedAt: isFinalFailure ? job.startedAt : null,
        completedAt: isFinalFailure ? new Date().toISOString() : null,
      })
      .where(eq(processingJobs.id, jobId))
      .run();
  }

  /**
   * Reset all 'processing' jobs to 'pending' (crash recovery).
   * @returns Number of jobs that were reset
   */
  async resetStaleJobs(): Promise<number> {
    const result = this.db.update(processingJobs)
      .set({ status: 'pending', startedAt: null })
      .where(eq(processingJobs.status, 'processing'))
      .run();

    return result.changes;
  }

  /**
   * Count pending jobs in the queue.
   * @returns Number of pending jobs
   */
  async countPending(): Promise<number> {
    const rows = this.db
      .select({ count: sql<number>`count(*)` })
      .from(processingJobs)
      .where(eq(processingJobs.status, 'pending'))
      .all();

    return rows[0]?.count ?? 0;
  }

  /**
   * Convert a DB row to a ProcessingJob domain type.
   * @param row - Database row
   * @returns ProcessingJob
   */
  private toProcessingJob(row: typeof processingJobs.$inferSelect): ProcessingJob {
    return {
      id: row.id,
      invoiceId: row.invoiceId,
      status: row.status as ProcessingJob['status'],
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      lastError: row.lastError,
      createdAt: new Date(row.createdAt),
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
    };
  }
}
