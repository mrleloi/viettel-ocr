import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { MappingProps, MappingStatus, MappingSource } from '@invoice-tool/shared';

const VALID_SOURCES: MappingSource[] = ['manual', 'auto_learned', 'bulk_import'];

/** Props required to create a new Mapping */
export interface CreateMappingProps {
  readonly id?: string;
  readonly schemaId: string;
  readonly partnerProductName: string;
  readonly partnerProductCode?: string | null;
  readonly viettelProductId?: string | null;
  readonly viettelProductCode?: string | null;
  readonly viettelProductName?: string | null;
  readonly source: string;
  readonly confidence?: number | null;
}

/**
 * Mapping entity — maps a partner product name to a Viettel product.
 * Supports manual, auto-learned, and bulk-imported mappings.
 */
export class Mapping {
  private props: MappingProps;

  private constructor(props: MappingProps) {
    this.props = props;
  }

  /**
   * Create a new Mapping.
   * Auto-learned mappings start as pending_review; manual/bulk start as active.
   * @param input Required fields for a new mapping
   * @returns A new Mapping instance
   * @throws DomainError if required fields are invalid
   */
  static create(input: CreateMappingProps): Mapping {
    if (!input.schemaId) {
      throw new DomainError('Mapping schema ID is required');
    }
    if (!input.partnerProductName) {
      throw new DomainError('Mapping partner product name is required');
    }
    if (!VALID_SOURCES.includes(input.source as MappingSource)) {
      throw new DomainError(`Invalid mapping source: "${input.source}". Must be one of: ${VALID_SOURCES.join(', ')}`);
    }
    if (input.confidence !== undefined && input.confidence !== null) {
      if (input.confidence < 0 || input.confidence > 1) {
        throw new DomainError(`Mapping confidence must be between 0 and 1, got: ${input.confidence}`);
      }
    }

    const source = input.source as MappingSource;
    const status: MappingStatus = source === 'auto_learned' ? 'pending_review' : 'active';
    const now = new Date();

    return new Mapping({
      id: input.id ?? generateId(),
      schemaId: input.schemaId,
      partnerProductName: input.partnerProductName,
      partnerProductCode: input.partnerProductCode ?? null,
      viettelProductId: input.viettelProductId ?? null,
      viettelProductCode: input.viettelProductCode ?? null,
      viettelProductName: input.viettelProductName ?? null,
      status,
      source,
      confidence: input.confidence ?? null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitute a Mapping from stored data (skips validation).
   * @param props All mapping properties from persistence
   * @returns A Mapping instance
   */
  static reconstitute(props: MappingProps): Mapping {
    return new Mapping({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schemaId(): string { return this.props.schemaId; }
  get partnerProductName(): string { return this.props.partnerProductName; }
  get partnerProductCode(): string | null { return this.props.partnerProductCode; }
  get viettelProductId(): string | null { return this.props.viettelProductId; }
  get viettelProductCode(): string | null { return this.props.viettelProductCode; }
  get viettelProductName(): string | null { return this.props.viettelProductName; }
  get status(): MappingStatus { return this.props.status; }
  get source(): MappingSource { return this.props.source; }
  get confidence(): number | null { return this.props.confidence; }
  get usageCount(): number { return this.props.usageCount; }
  get lastUsedAt(): Date | null { return this.props.lastUsedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // --- Business Methods ---

  /**
   * Link this mapping to a Viettel product.
   * @param productId Viettel product ID
   * @param productCode Viettel product code
   * @param productName Viettel product name
   */
  linkToViettelProduct(productId: string, productCode: string, productName: string): void {
    this.props = {
      ...this.props,
      viettelProductId: productId,
      viettelProductCode: productCode,
      viettelProductName: productName,
      updatedAt: new Date(),
    };
  }

  /**
   * Increment usage count (called each time this mapping is applied).
   */
  incrementUsage(): void {
    this.props = {
      ...this.props,
      usageCount: this.props.usageCount + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Deactivate this mapping.
   */
  deactivate(): void {
    this.props = { ...this.props, status: 'inactive', updatedAt: new Date() };
  }

  /**
   * Approve a pending_review mapping → active.
   * @throws DomainError if not in pending_review status
   */
  approve(): void {
    if (this.props.status !== 'pending_review') {
      throw new DomainError(`Cannot approve mapping in "${this.props.status}" status`);
    }
    this.props = { ...this.props, status: 'active', updatedAt: new Date() };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns MappingProps
   */
  toProps(): MappingProps {
    return { ...this.props };
  }
}
