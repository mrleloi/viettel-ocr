import { Injectable, Inject } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { syncConflicts } from '../schema';
import type { ISyncConflictRepository } from '../../../domain/product/sync-conflict.repository';
import { SyncConflict } from '../../../domain/product/sync-conflict.entity';
import type { SyncConflictProps } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of ISyncConflictRepository.
 */
@Injectable()
export class SyncConflictRepositoryImpl implements ISyncConflictRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find all unresolved sync conflicts.
   * @returns Array of conflicts where resolvedAt is null
   */
  async findUnresolved(): Promise<SyncConflict[]> {
    const rows = await this.db.select().from(syncConflicts)
      .where(isNull(syncConflicts.resolvedAt))
      .all();
    return rows.map((row) => SyncConflict.reconstitute(this.toDomain(row)));
  }

  /**
   * Persist a sync conflict (insert or update).
   * @param conflict SyncConflict entity to save
   */
  async save(conflict: SyncConflict): Promise<void> {
    const data = this.toPersistence(conflict);
    await this.db.insert(syncConflicts).values(data)
      .onConflictDoUpdate({ target: syncConflicts.id, set: data });
  }

  /**
   * Resolve a conflict with the given action.
   * @param id Conflict ID
   * @param resolution Resolution action
   */
  async resolve(id: string, resolution: 'keep_local' | 'accept_remote'): Promise<void> {
    await this.db.update(syncConflicts)
      .set({
        resolvedAction: resolution,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(syncConflicts.id, id));
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns SyncConflictProps for reconstitution
   */
  private toDomain(row: typeof syncConflicts.$inferSelect): SyncConflictProps {
    return {
      id: row.id,
      productId: row.productId,
      fieldName: row.fieldName,
      localValue: row.localValue,
      remoteValue: row.remoteValue,
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
      resolvedAction: row.resolvedAction as ('keep_local' | 'accept_remote' | null),
      createdAt: new Date(row.createdAt),
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity SyncConflict entity
   * @returns Insert/update values
   */
  private toPersistence(entity: SyncConflict): typeof syncConflicts.$inferInsert {
    return {
      id: entity.id,
      productId: entity.productId,
      fieldName: entity.fieldName,
      localValue: entity.localValue,
      remoteValue: entity.remoteValue,
      resolvedAt: entity.resolvedAt?.toISOString() ?? null,
      resolvedAction: entity.resolvedAction,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
