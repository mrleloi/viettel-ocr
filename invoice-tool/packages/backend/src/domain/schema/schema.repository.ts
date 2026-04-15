import type { Schema } from './schema.entity';

/**
 * Repository interface for Schema aggregate persistence.
 * Implementations live in infrastructure layer.
 */
export interface ISchemaRepository {
  /**
   * Find a schema by its unique ID.
   * @param id Schema ID
   * @returns The Schema if found, null otherwise
   */
  findById(id: string): Promise<Schema | null>;

  /**
   * Find all active schemas.
   * @returns Array of schemas with 'active' status
   */
  findActive(): Promise<Schema[]>;

  /**
   * Find all schemas (active + draft, excluding archived).
   * @returns Array of all non-archived schemas
   */
  findAll(): Promise<Schema[]>;

  /**
   * Find a schema by the NCC's tax ID.
   * @param taxId NCC tax ID (MST)
   * @returns The Schema if found, null otherwise
   */
  findByNccTaxId(taxId: string): Promise<Schema | null>;

  /**
   * Persist a schema (insert or update).
   * @param schema Schema entity to save
   */
  save(schema: Schema): Promise<void>;
}
