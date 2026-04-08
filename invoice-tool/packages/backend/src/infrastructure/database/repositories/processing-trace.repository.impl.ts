import { Inject, Injectable } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../connection';
import type { AppDatabase } from '../connection';
import { processingTraces } from '../schema';
import { ProcessingTrace } from '../../../domain/processing/processing-trace.entity';
import type { IProcessingTraceRepository } from '../../../domain/processing/processing-trace.repository';

/**
 * Drizzle + SQLite implementation of IProcessingTraceRepository.
 * Maps between the ProcessingTrace domain entity and the `processing_traces` DB table.
 */
@Injectable()
export class ProcessingTraceRepositoryImpl implements IProcessingTraceRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: AppDatabase,
  ) {}

  /**
   * Persist a processing trace (upsert).
   * @param trace - ProcessingTrace entity to save
   */
  async save(trace: ProcessingTrace): Promise<void> {
    const data = {
      id: trace.id,
      invoiceId: trace.invoiceId,
      stage: trace.stage,
      status: trace.status,
      inputData: trace.inputData,
      outputData: trace.outputData,
      errorMessage: trace.errorMessage,
      durationMs: trace.durationMs,
      createdAt: trace.createdAt.toISOString(),
    };

    this.db
      .insert(processingTraces)
      .values(data)
      .onConflictDoUpdate({
        target: processingTraces.id,
        set: {
          stage: data.stage,
          status: data.status,
          inputData: data.inputData,
          outputData: data.outputData,
          errorMessage: data.errorMessage,
          durationMs: data.durationMs,
        },
      })
      .run();
  }

  /**
   * Find all processing traces for an invoice, ordered by createdAt ASC.
   * @param invoiceId - Invoice ID
   * @returns Array of ProcessingTrace entities in chronological order
   */
  async findByInvoiceId(invoiceId: string): Promise<ProcessingTrace[]> {
    const rows = await this.db
      .select()
      .from(processingTraces)
      .where(eq(processingTraces.invoiceId, invoiceId))
      .orderBy(asc(processingTraces.createdAt))
      .all();

    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Map a DB row to a ProcessingTrace domain entity.
   * @param row - Raw DB row
   * @returns ProcessingTrace domain entity
   */
  private toDomain(row: typeof processingTraces.$inferSelect): ProcessingTrace {
    return ProcessingTrace.reconstitute({
      id: row.id,
      invoiceId: row.invoiceId,
      stage: row.stage,
      status: row.status,
      inputData: row.inputData ?? null,
      outputData: row.outputData ?? null,
      errorMessage: row.errorMessage ?? null,
      durationMs: row.durationMs ?? null,
      createdAt: new Date(row.createdAt),
    });
  }
}
