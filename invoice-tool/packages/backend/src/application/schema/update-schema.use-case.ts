import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import { Injectable, Inject } from '@nestjs/common';

/** Input for updating a schema */
export interface UpdateSchemaInput {
  /** Schema ID to update */
  readonly schemaId: string;
  /** Optional new name */
  readonly name?: string;
  /** Optional new description */
  readonly description?: string;
  /** Optional new NCC name */
  readonly nccName?: string;
  /** Optional new prompt template */
  readonly promptTemplate?: string;
  /** Optional status transition: 'activate' or 'deactivate' */
  readonly statusAction?: 'activate' | 'deactivate';
}

/** Output after schema update */
export interface UpdateSchemaOutput {
  /** Updated schema ID */
  readonly schemaId: string;
  /** Current name */
  readonly name: string;
  /** Current status */
  readonly status: string;
}

/**
 * UpdateSchemaUseCase — updates schema properties, optionally activates/deactivates.
 *
 * Orchestrates:
 * 1. Find schema by ID
 * 2. Apply field updates via schema.updateInfo()
 * 3. Apply prompt template update via schema.updatePromptTemplate()
 * 4. Apply status transition if requested
 * 5. Persist changes
 */
@Injectable()
export class UpdateSchemaUseCase {
  constructor(
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
  ) {}

  /**
   * Execute the schema update flow.
   * @param input - Update parameters
   * @returns Updated schema info
   */
  async execute(input: UpdateSchemaInput): Promise<UpdateSchemaOutput> {
    const schema = await this.schemaRepo.findById(input.schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${input.schemaId}`);
    }

    // Apply info updates
    if (input.name || input.description !== undefined || input.nccName) {
      schema.updateInfo({
        name: input.name,
        description: input.description,
        nccName: input.nccName,
      });
    }

    // Apply prompt template update
    if (input.promptTemplate !== undefined) {
      schema.updatePromptTemplate(input.promptTemplate);
    }

    // Apply status transition
    if (input.statusAction === 'activate') {
      schema.activate();
    } else if (input.statusAction === 'deactivate') {
      schema.deactivate();
    }

    await this.schemaRepo.save(schema);

    return {
      schemaId: schema.id,
      name: schema.name,
      status: schema.status,
    };
  }
}
