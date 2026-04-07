import type { FieldDefinition } from './field-definition.entity';

/**
 * Repository interface for FieldDefinition persistence.
 * Implementations live in infrastructure layer.
 */
export interface IFieldDefinitionRepository {
  /**
   * Find all field definitions for a specific schema.
   * @param schemaId Schema ID
   * @returns Array of field definitions, ordered by sortOrder
   */
  findBySchemaId(schemaId: string): Promise<FieldDefinition[]>;

  /**
   * Persist a field definition (insert or update).
   * @param fieldDef FieldDefinition entity to save
   */
  save(fieldDef: FieldDefinition): Promise<void>;

  /**
   * Delete a field definition by ID.
   * @param id FieldDefinition ID to delete
   */
  delete(id: string): Promise<void>;
}
