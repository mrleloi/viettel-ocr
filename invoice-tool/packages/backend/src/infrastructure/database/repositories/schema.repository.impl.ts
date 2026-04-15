import { Injectable, Inject } from '@nestjs/common';
import { eq, ne } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { schemas } from '../schema';
import type { ISchemaRepository } from '../../../domain/schema/schema.repository';
import { Schema } from '../../../domain/schema/schema.entity';
import type { SchemaProps, SchemaStatus } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of ISchemaRepository.
 * Maps between Schema entities and the `schemas` table.
 */
@Injectable()
export class SchemaRepositoryImpl implements ISchemaRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find a schema by its unique ID.
   * @param id Schema ID
   * @returns The Schema if found, null otherwise
   */
  async findById(id: string): Promise<Schema | null> {
    const row = await this.db.select().from(schemas).where(eq(schemas.id, id)).get();
    if (!row) return null;
    return Schema.reconstitute(this.toDomain(row));
  }

  /**
   * Find all active schemas.
   * @returns Array of schemas with 'active' status
   */
  async findActive(): Promise<Schema[]> {
    const rows = await this.db.select().from(schemas).where(eq(schemas.status, 'active')).all();
    return rows.map((row) => Schema.reconstitute(this.toDomain(row)));
  }

  /**
   * Find all schemas (active + draft, excluding archived).
   * @returns Array of all non-archived schemas
   */
  async findAll(): Promise<Schema[]> {
    const rows = await this.db.select().from(schemas).where(ne(schemas.status, 'archived')).all();
    return rows.map((row) => Schema.reconstitute(this.toDomain(row)));
  }

  /**
   * Find a schema by the NCC's tax ID.
   * @param taxId NCC tax ID (MST)
   * @returns The Schema if found, null otherwise
   */
  async findByNccTaxId(taxId: string): Promise<Schema | null> {
    const row = await this.db.select().from(schemas).where(eq(schemas.nccTaxId, taxId)).get();
    if (!row) return null;
    return Schema.reconstitute(this.toDomain(row));
  }

  /**
   * Persist a schema (insert or update).
   * @param schema Schema entity to save
   */
  async save(schema: Schema): Promise<void> {
    const data = this.toPersistence(schema);
    await this.db.insert(schemas).values(data)
      .onConflictDoUpdate({ target: schemas.id, set: data });
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row from `schemas` table
   * @returns SchemaProps for reconstitution
   */
  private toDomain(row: typeof schemas.$inferSelect): SchemaProps {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      nccName: row.nccName,
      nccTaxId: row.nccTaxId,
      status: row.status as SchemaStatus,
      promptTemplate: row.promptTemplate ?? null,
      behaviorConfig: row.behaviorConfig ?? null,
      version: row.version,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity Schema entity
   * @returns Insert/update values for `schemas` table
   */
  private toPersistence(entity: Schema): typeof schemas.$inferInsert {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      nccName: entity.nccName,
      nccTaxId: entity.nccTaxId,
      status: entity.status,
      promptTemplate: entity.promptTemplate,
      behaviorConfig: entity.behaviorConfig,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
