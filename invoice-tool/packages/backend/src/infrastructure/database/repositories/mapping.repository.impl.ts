import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { mappings } from '../schema';
import type { IMappingRepository } from '../../../domain/mapping/mapping.repository';
import { Mapping } from '../../../domain/mapping/mapping.entity';
import type { MappingProps, MappingStatus, MappingSource } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of IMappingRepository.
 */
@Injectable()
export class MappingRepositoryImpl implements IMappingRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find a mapping by partner product name within a schema.
   * @param name Partner product name
   * @param schemaId Schema ID
   * @returns The Mapping if found, null otherwise
   */
  async findByPartnerName(name: string, schemaId: string): Promise<Mapping | null> {
    const row = await this.db.select().from(mappings)
      .where(and(
        eq(mappings.partnerProductName, name),
        eq(mappings.schemaId, schemaId),
      ))
      .get();
    if (!row) return null;
    return Mapping.reconstitute(this.toDomain(row));
  }

  /**
   * Find all mappings for a specific schema.
   * @param schemaId Schema ID
   * @returns Array of mappings
   */
  async findBySchemaId(schemaId: string): Promise<Mapping[]> {
    const rows = await this.db.select().from(mappings)
      .where(eq(mappings.schemaId, schemaId))
      .all();
    return rows.map((row) => Mapping.reconstitute(this.toDomain(row)));
  }

  /**
   * Persist a mapping (insert or update).
   * @param mapping Mapping entity to save
   */
  async save(mapping: Mapping): Promise<void> {
    const data = this.toPersistence(mapping);
    await this.db.insert(mappings).values(data)
      .onConflictDoUpdate({ target: mappings.id, set: data });
  }

  /**
   * Increment usage count for a mapping.
   * @param id Mapping ID
   */
  async incrementUsage(id: string): Promise<void> {
    await this.db.update(mappings)
      .set({
        usageCount: sql`${mappings.usageCount} + 1`,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mappings.id, id));
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns MappingProps for reconstitution
   */
  private toDomain(row: typeof mappings.$inferSelect): MappingProps {
    return {
      id: row.id,
      schemaId: row.schemaId,
      partnerProductName: row.partnerProductName,
      partnerProductCode: row.partnerProductCode ?? null,
      viettelProductId: row.viettelProductId ?? null,
      viettelProductCode: row.viettelProductCode ?? null,
      viettelProductName: row.viettelProductName ?? null,
      status: row.status as MappingStatus,
      source: row.source as MappingSource,
      confidence: row.confidence ?? null,
      usageCount: row.usageCount,
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity Mapping entity
   * @returns Insert/update values
   */
  private toPersistence(entity: Mapping): typeof mappings.$inferInsert {
    return {
      id: entity.id,
      schemaId: entity.schemaId,
      partnerProductName: entity.partnerProductName,
      partnerProductCode: entity.partnerProductCode,
      viettelProductId: entity.viettelProductId,
      viettelProductCode: entity.viettelProductCode,
      viettelProductName: entity.viettelProductName,
      status: entity.status,
      source: entity.source,
      confidence: entity.confidence,
      usageCount: entity.usageCount,
      lastUsedAt: entity.lastUsedAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
