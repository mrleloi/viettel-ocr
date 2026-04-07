import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { FieldDefinitionProps, FieldDataType } from '@invoice-tool/shared';

const VALID_DATA_TYPES: FieldDataType[] = ['string', 'integer', 'number', 'date', 'boolean'];

/** Props required to create a new FieldDefinition */
export interface CreateFieldDefinitionProps {
  readonly id?: string;
  readonly schemaId: string;
  readonly fieldName: string;
  readonly displayName: string;
  readonly dataType: string;
  readonly isRequired: boolean;
  readonly validationRules?: string | null;
  readonly extractionHint?: string | null;
  readonly sortOrder: number;
}

/** Props for updating a FieldDefinition */
export interface UpdateFieldDefinitionProps {
  readonly displayName?: string;
  readonly isRequired?: boolean;
  readonly validationRules?: string | null;
  readonly extractionHint?: string | null;
  readonly sortOrder?: number;
}

/**
 * FieldDefinition entity — describes a field to extract from an invoice.
 * Tied to a Schema and defines extraction hints, data types, and validation rules.
 */
export class FieldDefinition {
  private props: FieldDefinitionProps;

  private constructor(props: FieldDefinitionProps) {
    this.props = props;
  }

  /**
   * Create a new FieldDefinition.
   * @param input Required fields for a new field definition
   * @returns A new FieldDefinition instance
   * @throws DomainError if required fields are invalid
   */
  static create(input: CreateFieldDefinitionProps): FieldDefinition {
    if (!input.fieldName) {
      throw new DomainError('Field name is required');
    }
    if (!input.displayName) {
      throw new DomainError('Display name is required');
    }
    if (!VALID_DATA_TYPES.includes(input.dataType as FieldDataType)) {
      throw new DomainError(`Invalid data type: "${input.dataType}". Must be one of: ${VALID_DATA_TYPES.join(', ')}`);
    }
    if (input.sortOrder < 0) {
      throw new DomainError('Sort order cannot be negative');
    }

    return new FieldDefinition({
      id: input.id ?? generateId(),
      schemaId: input.schemaId,
      fieldName: input.fieldName,
      displayName: input.displayName,
      dataType: input.dataType as FieldDataType,
      isRequired: input.isRequired,
      validationRules: input.validationRules ?? null,
      extractionHint: input.extractionHint ?? null,
      sortOrder: input.sortOrder,
    });
  }

  /**
   * Reconstitute a FieldDefinition from stored data (skips validation).
   * @param props All field definition properties from persistence
   * @returns A FieldDefinition instance
   */
  static reconstitute(props: FieldDefinitionProps): FieldDefinition {
    return new FieldDefinition({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schemaId(): string { return this.props.schemaId; }
  get fieldName(): string { return this.props.fieldName; }
  get displayName(): string { return this.props.displayName; }
  get dataType(): FieldDataType { return this.props.dataType; }
  get isRequired(): boolean { return this.props.isRequired; }
  get validationRules(): string | null { return this.props.validationRules; }
  get extractionHint(): string | null { return this.props.extractionHint; }
  get sortOrder(): number { return this.props.sortOrder; }

  /**
   * Update mutable fields of this definition.
   * @param updates Partial set of fields to update
   */
  update(updates: UpdateFieldDefinitionProps): void {
    this.props = {
      ...this.props,
      displayName: updates.displayName ?? this.props.displayName,
      isRequired: updates.isRequired ?? this.props.isRequired,
      validationRules: updates.validationRules !== undefined ? updates.validationRules : this.props.validationRules,
      extractionHint: updates.extractionHint !== undefined ? updates.extractionHint : this.props.extractionHint,
      sortOrder: updates.sortOrder ?? this.props.sortOrder,
    };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns FieldDefinitionProps
   */
  toProps(): FieldDefinitionProps {
    return { ...this.props };
  }
}
