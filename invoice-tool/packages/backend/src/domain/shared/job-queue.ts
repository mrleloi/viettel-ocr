/**
 * Represents a processing job in the queue.
 */
export interface ProcessingJob {
  /** Unique job identifier */
  readonly id: string;
  /** Invoice to process */
  readonly invoiceId: string;
  /** Current job status */
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Number of processing attempts so far */
  readonly attempts: number;
  /** Maximum allowed attempts before permanent failure */
  readonly maxAttempts: number;
  /** Last error message (if failed) */
  readonly lastError: string | null;
  /** When the job was created */
  readonly createdAt: Date;
  /** When the job started processing */
  readonly startedAt: Date | null;
  /** When the job completed (success or final failure) */
  readonly completedAt: Date | null;
}

/**
 * Domain port interface for the processing job queue.
 *
 * Infrastructure implementations (e.g., SQLite-backed queue) provide the
 * concrete persistence and concurrency control. Application layer depends
 * only on this interface.
 */
export interface IJobQueue {
  /**
   * Add a job to the queue for an invoice.
   * @param invoiceId - Invoice ID to process
   * @returns Created job ID
   */
  enqueue(invoiceId: string): Promise<string>;

  /**
   * Atomically claim up to `limit` pending jobs, transitioning them to 'processing'.
   * Prevents double-processing by concurrent callers.
   * @param limit - Maximum number of jobs to take
   * @returns Array of jobs now in 'processing' status
   */
  takePending(limit: number): Promise<ProcessingJob[]>;

  /**
   * Mark a job as successfully completed.
   * @param jobId - Job ID
   */
  markCompleted(jobId: string): Promise<void>;

  /**
   * Mark a job as failed for this attempt.
   * If attempts < maxAttempts → status resets to 'pending' for retry.
   * If attempts >= maxAttempts → status becomes 'failed' permanently.
   * @param jobId - Job ID
   * @param error - Error message describing the failure
   */
  markFailed(jobId: string, error: string): Promise<void>;

  /**
   * Reset all 'processing' jobs back to 'pending'.
   * Called on startup to recover from interrupted processing (crash recovery).
   * @returns Number of jobs that were reset
   */
  resetStaleJobs(): Promise<number>;

  /**
   * Get the count of jobs in 'pending' status.
   * @returns Number of pending jobs
   */
  countPending(): Promise<number>;
}
