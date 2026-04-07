import type { FingerprintRule } from './fingerprint-rule.entity';

/**
 * Repository interface for FingerprintRule persistence.
 * Implementations live in infrastructure layer.
 */
export interface IFingerprintRuleRepository {
  /**
   * Find all fingerprint rules for a specific schema.
   * @param schemaId Schema ID
   * @returns Array of fingerprint rules
   */
  findBySchemaId(schemaId: string): Promise<FingerprintRule[]>;

  /**
   * Find all active fingerprint rules across all schemas.
   * @returns Array of active fingerprint rules
   */
  findAllActive(): Promise<FingerprintRule[]>;

  /**
   * Persist a fingerprint rule (insert or update).
   * @param rule FingerprintRule entity to save
   */
  save(rule: FingerprintRule): Promise<void>;

  /**
   * Delete a fingerprint rule by ID.
   * @param id Rule ID to delete
   */
  delete(id: string): Promise<void>;
}
