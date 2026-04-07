/**
 * Mapping domain types shared between frontend and backend.
 */

/** Mapping status */
export type MappingStatus = 'active' | 'inactive' | 'pending_review';

/** How the mapping was created */
export type MappingSource = 'manual' | 'auto_learned' | 'bulk_import';

/** Core mapping properties */
export interface MappingProps {
  readonly id: string;
  readonly schemaId: string;
  readonly partnerProductName: string;
  readonly partnerProductCode: string | null;
  readonly viettelProductId: string | null;
  readonly viettelProductCode: string | null;
  readonly viettelProductName: string | null;
  readonly status: MappingStatus;
  readonly source: MappingSource;
  readonly confidence: number | null;
  readonly usageCount: number;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
