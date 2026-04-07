/**
 * Product domain types shared between frontend and backend.
 */

/** Product sync status */
export type ProductSyncStatus = 'synced' | 'local_only' | 'conflict' | 'deleted_upstream';

/** Core product properties */
export interface ProductProps {
  readonly id: string;
  readonly productCode: string;
  readonly productName: string;
  readonly unit: string | null;
  readonly category: string | null;
  readonly brand: string | null;
  readonly isActive: boolean;
  readonly syncStatus: ProductSyncStatus;
  readonly externalId: string | null;
  readonly lastSyncedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Sync conflict properties */
export interface SyncConflictProps {
  readonly id: string;
  readonly productId: string;
  readonly fieldName: string;
  readonly localValue: string;
  readonly remoteValue: string;
  readonly resolvedAt: Date | null;
  readonly resolvedAction: 'keep_local' | 'accept_remote' | null;
  readonly createdAt: Date;
}
