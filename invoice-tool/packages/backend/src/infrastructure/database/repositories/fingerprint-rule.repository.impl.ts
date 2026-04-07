import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { fingerprintRules } from '../schema';
import type { IFingerprintRuleRepository } from '../../../domain/schema/fingerprint-rule.repository';
import { FingerprintRule } from '../../../domain/schema/fingerprint-rule.entity';
import type { FingerprintRuleProps, FingerprintRuleType } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of IFingerprintRuleRepository.
 */
@Injectable()
export class FingerprintRuleRepositoryImpl implements IFingerprintRuleRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find all fingerprint rules for a specific schema.
   * @param schemaId Schema ID
   * @returns Array of fingerprint rules
   */
  async findBySchemaId(schemaId: string): Promise<FingerprintRule[]> {
    const rows = await this.db.select().from(fingerprintRules)
      .where(eq(fingerprintRules.schemaId, schemaId)).all();
    return rows.map((row) => FingerprintRule.reconstitute(this.toDomain(row)));
  }

  /**
   * Find all active fingerprint rules across all schemas.
   * @returns Array of active fingerprint rules
   */
  async findAllActive(): Promise<FingerprintRule[]> {
    const rows = await this.db.select().from(fingerprintRules)
      .where(eq(fingerprintRules.isActive, true)).all();
    return rows.map((row) => FingerprintRule.reconstitute(this.toDomain(row)));
  }

  /**
   * Persist a fingerprint rule (insert or update).
   * @param rule FingerprintRule entity to save
   */
  async save(rule: FingerprintRule): Promise<void> {
    const data = this.toPersistence(rule);
    await this.db.insert(fingerprintRules).values(data)
      .onConflictDoUpdate({ target: fingerprintRules.id, set: data });
  }

  /**
   * Delete a fingerprint rule by ID.
   * @param id Rule ID to delete
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(fingerprintRules).where(eq(fingerprintRules.id, id));
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns FingerprintRuleProps for reconstitution
   */
  private toDomain(row: typeof fingerprintRules.$inferSelect): FingerprintRuleProps {
    return {
      id: row.id,
      schemaId: row.schemaId,
      ruleType: row.ruleType as FingerprintRuleType,
      pattern: row.pattern,
      priority: row.priority,
      isActive: row.isActive,
      createdAt: new Date(row.createdAt),
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity FingerprintRule entity
   * @returns Insert/update values
   */
  private toPersistence(entity: FingerprintRule): typeof fingerprintRules.$inferInsert {
    return {
      id: entity.id,
      schemaId: entity.schemaId,
      ruleType: entity.ruleType,
      pattern: entity.pattern,
      priority: entity.priority,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
