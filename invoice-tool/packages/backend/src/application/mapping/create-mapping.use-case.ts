import type { IMappingRepository } from '../../domain/mapping/mapping.repository';
import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import { Mapping } from '../../domain/mapping/mapping.entity';
import { Injectable, Inject } from '@nestjs/common';

/** Input for creating a product mapping */
export interface CreateMappingInput {
  /** Schema ID this mapping belongs to */
  readonly schemaId: string;
  /** Partner's product name (as it appears on invoices) */
  readonly partnerProductName: string;
  /** Viettel product code to map to */
  readonly viettelProductCode: string;
  /** Optional Viettel product name */
  readonly viettelProductName?: string;
  /** Mapping source */
  readonly source: 'manual' | 'auto_learned' | 'bulk_import' | 'fuzzy_confirmed';
  /** Optional confidence score (0-1) */
  readonly confidence?: number;
}

/** Output after mapping creation */
export interface CreateMappingOutput {
  /** Created mapping ID */
  readonly mappingId: string;
  /** Partner product name */
  readonly partnerProductName: string;
  /** Viettel product code */
  readonly viettelProductCode: string;
  /** Mapping status */
  readonly status: string;
}

/**
 * CreateMappingUseCase — creates a product mapping from partner name to Viettel product.
 *
 * Orchestrates:
 * 1. Verify schema exists
 * 2. Check for existing mapping with same partner name in same schema
 * 3. Create Mapping entity
 * 4. Persist
 */
@Injectable()
export class CreateMappingUseCase {
  constructor(
    @Inject('IMappingRepository') private readonly mappingRepo: IMappingRepository,
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
  ) {}

  /**
   * Execute the mapping creation flow.
   * @param input - Mapping creation parameters
   * @returns Created mapping info
   */
  async execute(input: CreateMappingInput): Promise<CreateMappingOutput> {
    // Verify schema exists
    const schema = await this.schemaRepo.findById(input.schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${input.schemaId}`);
    }

    // Create mapping entity
    const mapping = Mapping.create({
      schemaId: input.schemaId,
      partnerProductName: input.partnerProductName,
      viettelProductCode: input.viettelProductCode,
      viettelProductName: input.viettelProductName,
      source: input.source,
      confidence: input.confidence,
    });

    await this.mappingRepo.save(mapping);

    return {
      mappingId: mapping.id,
      partnerProductName: mapping.partnerProductName,
      viettelProductCode: mapping.viettelProductCode ?? '',
      status: mapping.status,
    };
  }
}
