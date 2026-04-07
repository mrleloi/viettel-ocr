import type { Batch } from './batch.entity';

/**
 * Repository interface for Batch aggregate persistence.
 * Implementations live in infrastructure layer.
 */
export interface IBatchRepository {
  /**
   * Find a batch by its unique ID.
   * @param id Batch ID
   * @returns The Batch if found, null otherwise
   */
  findById(id: string): Promise<Batch | null>;

  /**
   * Find recent batches, ordered by creation date descending.
   * @param limit Maximum number of batches to return
   * @returns Array of recent batches
   */
  findRecent(limit: number): Promise<Batch[]>;

  /**
   * Persist a batch (insert or update).
   * @param batch Batch entity to save
   */
  save(batch: Batch): Promise<void>;

  /**
   * Update batch processing counters atomically.
   * @param id Batch ID
   * @param processedFiles New processed count
   * @param successFiles New success count
   * @param errorFiles New error count
   */
  updateCounters(id: string, processedFiles: number, successFiles: number, errorFiles: number): Promise<void>;
}
