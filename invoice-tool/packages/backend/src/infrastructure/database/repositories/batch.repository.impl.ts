import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { batches } from '../schema';
import type { IBatchRepository } from '../../../domain/batch/batch.repository';
import { Batch } from '../../../domain/batch/batch.entity';
import type { BatchProps, BatchStatus, UploadMode } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of IBatchRepository.
 */
@Injectable()
export class BatchRepositoryImpl implements IBatchRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find a batch by its unique ID.
   * @param id Batch ID
   * @returns The Batch if found, null otherwise
   */
  async findById(id: string): Promise<Batch | null> {
    const row = await this.db.select().from(batches).where(eq(batches.id, id)).get();
    if (!row) return null;
    return Batch.reconstitute(this.toDomain(row));
  }

  /**
   * Find recent batches, ordered by creation date descending.
   * @param limit Maximum number of batches to return
   * @returns Array of recent batches
   */
  async findRecent(limit: number): Promise<Batch[]> {
    const rows = await this.db.select().from(batches)
      .orderBy(desc(batches.createdAt))
      .limit(limit)
      .all();
    return rows.map((row) => Batch.reconstitute(this.toDomain(row)));
  }

  /**
   * Persist a batch (insert or update).
   * @param batch Batch entity to save
   */
  async save(batch: Batch): Promise<void> {
    const data = this.toPersistence(batch);
    await this.db.insert(batches).values(data)
      .onConflictDoUpdate({ target: batches.id, set: data });
  }

  /**
   * Update batch processing counters atomically.
   * @param id Batch ID
   * @param processedFiles New processed count
   * @param successFiles New success count
   * @param errorFiles New error count
   */
  async updateCounters(id: string, processedFiles: number, successFiles: number, errorFiles: number): Promise<void> {
    await this.db.update(batches)
      .set({ processedFiles, successFiles, errorFiles })
      .where(eq(batches.id, id));
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns BatchProps for reconstitution
   */
  private toDomain(row: typeof batches.$inferSelect): BatchProps {
    return {
      id: row.id,
      uploadMode: row.uploadMode as UploadMode,
      hintSchemaId: row.hintSchemaId ?? null,
      totalFiles: row.totalFiles,
      processedFiles: row.processedFiles,
      successFiles: row.successFiles,
      errorFiles: row.errorFiles,
      status: row.status as BatchStatus,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      autoCreateSchemaOnNewPattern: row.autoCreateSchema ?? false,
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity Batch entity
   * @returns Insert/update values
   */
  private toPersistence(entity: Batch): typeof batches.$inferInsert {
    return {
      id: entity.id,
      uploadMode: entity.uploadMode,
      hintSchemaId: entity.hintSchemaId,
      totalFiles: entity.totalFiles,
      processedFiles: entity.processedFiles,
      successFiles: entity.successFiles,
      errorFiles: entity.errorFiles,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString() ?? null,
      autoCreateSchema: entity.autoCreateSchemaOnNewPattern,
    };
  }
}
