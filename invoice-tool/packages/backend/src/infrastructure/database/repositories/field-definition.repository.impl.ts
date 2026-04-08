import { Injectable, Inject } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { fieldDefinitions } from '../schema';
import type { IFieldDefinitionRepository } from '../../../domain/schema/field-definition.repository';
import { FieldDefinition } from '../../../domain/schema/field-definition.entity';
import type { FieldDefinitionProps, FieldDataType } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of IFieldDefinitionRepository.
 */
@Injectable()
export class FieldDefinitionRepositoryImpl implements IFieldDefinitionRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find all field definitions for a specific schema, ordered by sortOrder.
   * @param schemaId Schema ID
   * @returns Array of field definitions
   */
  async findBySchemaId(schemaId: string): Promise<FieldDefinition[]> {
    const rows = await this.db.select().from(fieldDefinitions)
      .where(eq(fieldDefinitions.schemaId, schemaId))
      .orderBy(asc(fieldDefinitions.sortOrder))
      .all();
    return rows.map((row) => FieldDefinition.reconstitute(this.toDomain(row)));
  }

  /**
   * Persist a field definition (insert or update).
   * @param fieldDef FieldDefinition entity to save
   */
  async save(fieldDef: FieldDefinition): Promise<void> {
    const data = this.toPersistence(fieldDef);
    await this.db.insert(fieldDefinitions).values(data)
      .onConflictDoUpdate({ target: fieldDefinitions.id, set: data });
  }

  /**
   * Delete a field definition by ID.
   * @param id FieldDefinition ID to delete
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, id));
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns FieldDefinitionProps for reconstitution
   */
  private toDomain(row: typeof fieldDefinitions.$inferSelect): FieldDefinitionProps {
    return {
      id: row.id,
      schemaId: row.schemaId,
      fieldName: row.fieldName,
      displayName: row.displayName,
      dataType: row.dataType as FieldDataType,
      isRequired: row.isRequired,
      validationRules: row.validationRules ?? null,
      extractionHint: row.extractionHint ?? null,
      outputKey: row.outputKey ?? null,
      sortOrder: row.sortOrder,
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity FieldDefinition entity
   * @returns Insert/update values
   */
  private toPersistence(entity: FieldDefinition): typeof fieldDefinitions.$inferInsert {
    return {
      id: entity.id,
      schemaId: entity.schemaId,
      fieldName: entity.fieldName,
      displayName: entity.displayName,
      dataType: entity.dataType,
      isRequired: entity.isRequired,
      validationRules: entity.validationRules,
      extractionHint: entity.extractionHint,
      outputKey: entity.outputKey,
      sortOrder: entity.sortOrder,
    };
  }
}
