import type { SyncConflict } from './sync-conflict.entity';

/**
 * Repository interface for SyncConflict persistence.
 * Implementations live in infrastructure layer.
 */
export interface ISyncConflictRepository {
  /**
   * Find all unresolved sync conflicts.
   * @returns Array of conflicts where resolvedAt is null
   */
  findUnresolved(): Promise<SyncConflict[]>;

  /**
   * Persist a sync conflict (insert or update).
   * @param conflict SyncConflict entity to save
   */
  save(conflict: SyncConflict): Promise<void>;

  /**
   * Resolve a conflict with the given action.
   * @param id Conflict ID
   * @param resolution Resolution action: 'keep_local' or 'accept_remote'
   */
  resolve(id: string, resolution: 'keep_local' | 'accept_remote'): Promise<void>;
}
