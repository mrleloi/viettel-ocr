import type { Mapping } from './mapping.entity';

/**
 * Repository interface for Mapping aggregate persistence.
 * Implementations live in infrastructure layer.
 */
export interface IMappingRepository {
  /**
   * Find a mapping by partner product name within a schema.
   * @param name Partner product name
   * @param schemaId Schema ID
   * @returns The Mapping if found, null otherwise
   */
  findByPartnerName(name: string, schemaId: string): Promise<Mapping | null>;

  /**
   * Find all mappings for a specific schema.
   * @param schemaId Schema ID
   * @returns Array of mappings
   */
  findBySchemaId(schemaId: string): Promise<Mapping[]>;

  /**
   * Persist a mapping (insert or update).
   * @param mapping Mapping entity to save
   */
  save(mapping: Mapping): Promise<void>;

  /**
   * Increment usage count for a mapping.
   * @param id Mapping ID
   */
  incrementUsage(id: string): Promise<void>;
}
