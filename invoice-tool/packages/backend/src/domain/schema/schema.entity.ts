import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { SchemaProps, SchemaStatus } from '@invoice-tool/shared';

/** Props required to create a new Schema */
export interface CreateSchemaProps {
  readonly id?: string;
  readonly name: string;
  readonly description?: string | null;
  readonly nccName: string;
  readonly nccTaxId: string;
  readonly promptTemplate?: string | null;
  readonly behaviorConfig?: string | null;
}

/**
 * Schema entity — defines how to process invoices from a specific NCC.
 * Contains fingerprint rules, field definitions, prompt template, and behavior config.
 */
export class Schema {
  private props: SchemaProps;

  private constructor(props: SchemaProps) {
    this.props = props;
  }

  /**
   * Create a new Schema (starts in draft status, version 1).
   * @param input Required fields for a new schema
   * @returns A new Schema instance
   * @throws DomainError if required fields are missing
   */
  static create(input: CreateSchemaProps): Schema {
    if (!input.name) {
      throw new DomainError('Schema name is required');
    }
    if (!input.nccName) {
      throw new DomainError('Schema NCC name is required');
    }
    if (!input.nccTaxId) {
      throw new DomainError('Schema NCC tax ID is required');
    }

    const now = new Date();
    return new Schema({
      id: input.id ?? generateId(),
      name: input.name,
      description: input.description ?? null,
      nccName: input.nccName,
      nccTaxId: input.nccTaxId,
      status: 'draft',
      promptTemplate: input.promptTemplate ?? null,
      behaviorConfig: input.behaviorConfig ?? null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitute a Schema from stored data (skips validation).
   * @param props All schema properties from persistence
   * @returns A Schema instance
   */
  static reconstitute(props: SchemaProps): Schema {
    return new Schema({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get nccName(): string { return this.props.nccName; }
  get nccTaxId(): string { return this.props.nccTaxId; }
  get status(): SchemaStatus { return this.props.status; }
  get promptTemplate(): string | null { return this.props.promptTemplate; }
  get behaviorConfig(): string | null { return this.props.behaviorConfig; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // --- State Transitions ---

  /**
   * Activate the schema (from draft or inactive).
   * Idempotent — calling on active schema is a no-op.
   */
  activate(): void {
    this.props = { ...this.props, status: 'active', updatedAt: new Date() };
  }

  /**
   * Deactivate the schema (from active or draft).
   */
  deactivate(): void {
    this.props = { ...this.props, status: 'inactive', updatedAt: new Date() };
  }

  /**
   * Archive the schema (soft-delete — preserves data for history).
   * Archived schemas do not participate in classification.
   */
  archive(): void {
    this.props = { ...this.props, status: 'archived' as SchemaStatus, updatedAt: new Date() };
  }

  /**
   * Update the prompt template and increment version.
   * @param template New prompt template string
   */
  updatePromptTemplate(template: string): void {
    this.props = {
      ...this.props,
      promptTemplate: template,
      version: this.props.version + 1,
      updatedAt: new Date(),
    };
  }

  /**
   * Update the behavior config (JSON string).
   * @param config Serialized behavior configuration
   */
  updateBehaviorConfig(config: string): void {
    this.props = {
      ...this.props,
      behaviorConfig: config,
      updatedAt: new Date(),
    };
  }

  /**
   * Update schema basic info.
   * @param updates Partial updates to name, description, nccName
   */
  updateInfo(updates: { name?: string; description?: string | null; nccName?: string }): void {
    this.props = {
      ...this.props,
      name: updates.name ?? this.props.name,
      description: updates.description !== undefined ? updates.description : this.props.description,
      nccName: updates.nccName ?? this.props.nccName,
      updatedAt: new Date(),
    };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns SchemaProps
   */
  toProps(): SchemaProps {
    return { ...this.props };
  }
}
