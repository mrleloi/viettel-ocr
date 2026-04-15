import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import type { IFingerprintRuleRepository } from '../../domain/schema/fingerprint-rule.repository';
import type { IFieldDefinitionRepository } from '../../domain/schema/field-definition.repository';
import { Schema } from '../../domain/schema/schema.entity';
import { FingerprintRule } from '../../domain/schema/fingerprint-rule.entity';
import { FieldDefinition } from '../../domain/schema/field-definition.entity';
import { TaxId } from '../../domain/shared/value-objects/tax-id.vo';
import { Injectable, Inject, ConflictException } from '@nestjs/common';

/** Input for creating a schema */
export interface CreateSchemaInput {
  /** Schema display name */
  readonly name: string;
  /** NCC (supplier) name */
  readonly nccName: string;
  /** NCC tax ID (MST) */
  readonly nccTaxId: string;
  /** Optional description */
  readonly description?: string;
  /** Optional prompt template for AI extraction */
  readonly promptTemplate?: string;
  /** Optional fingerprint rules to create alongside */
  readonly fingerprintRules?: ReadonlyArray<{
    ruleType: string;
    pattern: string;
    priority: number;
  }>;
  /** Optional field definitions to create alongside */
  readonly fieldDefinitions?: ReadonlyArray<{
    fieldName: string;
    displayName: string;
    dataType: string;
    isRequired: boolean;
    extractionHint?: string;
  }>;
}

/** Output after schema creation */
export interface CreateSchemaOutput {
  /** Created schema ID */
  readonly schemaId: string;
  /** Schema name */
  readonly name: string;
  /** Schema status (always 'draft' for new schemas) */
  readonly status: string;
  /** Number of fingerprint rules created */
  readonly rulesCreated: number;
  /** Number of field definitions created */
  readonly fieldsCreated: number;
}

/**
 * CreateSchemaUseCase — creates a new schema with optional rules and fields.
 *
 * Orchestrates:
 * 1. Validate NCC tax ID format via TaxId value object
 * 2. Check name uniqueness (by NCC tax ID proxy)
 * 3. Create Schema entity (status: draft)
 * 4. Create FingerprintRule entities if provided
 * 5. Create FieldDefinition entities if provided
 * 6. Persist all
 */
@Injectable()
export class CreateSchemaUseCase {
  constructor(
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
    @Inject('IFingerprintRuleRepository') private readonly ruleRepo: IFingerprintRuleRepository,
    @Inject('IFieldDefinitionRepository') private readonly fieldRepo: IFieldDefinitionRepository,
  ) {}

  /**
   * Execute the schema creation flow.
   * @param input - Schema creation parameters
   * @returns Created schema info with counts
   */
  async execute(input: CreateSchemaInput): Promise<CreateSchemaOutput> {
    // Validate tax ID format
    TaxId.create(input.nccTaxId);

    // Check for duplicate by NCC tax ID
    const existing = await this.schemaRepo.findByNccTaxId(input.nccTaxId);
    if (existing) {
      throw new ConflictException(`Schema already exists for NCC tax ID: ${input.nccTaxId}`);
    }

    // Create schema entity
    const schema = Schema.create({
      name: input.name,
      nccName: input.nccName,
      nccTaxId: input.nccTaxId,
      description: input.description,
      promptTemplate: input.promptTemplate,
    });

    await this.schemaRepo.save(schema);

    // Create fingerprint rules
    let rulesCreated = 0;
    if (input.fingerprintRules && input.fingerprintRules.length > 0) {
      for (const ruleInput of input.fingerprintRules) {
        const rule = FingerprintRule.create({
          schemaId: schema.id,
          ruleType: ruleInput.ruleType,
          pattern: ruleInput.pattern,
          priority: ruleInput.priority,
        });
        await this.ruleRepo.save(rule);
        rulesCreated++;
      }
    }

    // Create field definitions
    let fieldsCreated = 0;
    if (input.fieldDefinitions && input.fieldDefinitions.length > 0) {
      for (let i = 0; i < input.fieldDefinitions.length; i++) {
        const fieldInput = input.fieldDefinitions[i];
        const fieldDef = FieldDefinition.create({
          schemaId: schema.id,
          fieldName: fieldInput.fieldName,
          displayName: fieldInput.displayName,
          dataType: fieldInput.dataType,
          isRequired: fieldInput.isRequired,
          extractionHint: fieldInput.extractionHint,
          sortOrder: i,
        });
        await this.fieldRepo.save(fieldDef);
        fieldsCreated++;
      }
    }

    return {
      schemaId: schema.id,
      name: schema.name,
      status: schema.status,
      rulesCreated,
      fieldsCreated,
    };
  }
}
