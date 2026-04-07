import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { ProductProps, ProductSyncStatus } from '@invoice-tool/shared';

/** Props required to create a new Product */
export interface CreateProductProps {
  readonly id?: string;
  readonly productCode: string;
  readonly productName: string;
  readonly unit?: string | null;
  readonly category?: string | null;
  readonly brand?: string | null;
}

/** Props for updating from remote sync */
export interface SyncUpdateProps {
  readonly productName?: string;
  readonly unit?: string | null;
  readonly category?: string | null;
  readonly brand?: string | null;
}

/**
 * Product entity — represents a Viettel product in the CATALOG context.
 * Tracks sync status with external Viettel Product API.
 */
export class Product {
  private props: ProductProps;

  private constructor(props: ProductProps) {
    this.props = props;
  }

  /**
   * Create a new Product (local_only status).
   * @param input Required fields for a new product
   * @returns A new Product instance
   * @throws DomainError if required fields are missing
   */
  static create(input: CreateProductProps): Product {
    if (!input.productCode) {
      throw new DomainError('Product code is required');
    }
    if (!input.productName) {
      throw new DomainError('Product name is required');
    }

    const now = new Date();
    return new Product({
      id: input.id ?? generateId(),
      productCode: input.productCode,
      productName: input.productName,
      unit: input.unit ?? null,
      category: input.category ?? null,
      brand: input.brand ?? null,
      isActive: true,
      syncStatus: 'local_only',
      externalId: null,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitute a Product from stored data (skips validation).
   * @param props All product properties from persistence
   * @returns A Product instance
   */
  static reconstitute(props: ProductProps): Product {
    return new Product({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get productCode(): string { return this.props.productCode; }
  get productName(): string { return this.props.productName; }
  get unit(): string | null { return this.props.unit; }
  get category(): string | null { return this.props.category; }
  get brand(): string | null { return this.props.brand; }
  get isActive(): boolean { return this.props.isActive; }
  get syncStatus(): ProductSyncStatus { return this.props.syncStatus; }
  get externalId(): string | null { return this.props.externalId; }
  get lastSyncedAt(): Date | null { return this.props.lastSyncedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // --- Sync Lifecycle ---

  /**
   * Mark product as synced with external system.
   * @param externalId The external system's ID for this product
   */
  markSynced(externalId: string): void {
    const now = new Date();
    this.props = {
      ...this.props,
      syncStatus: 'synced',
      externalId,
      lastSyncedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Mark product as having a sync conflict.
   */
  markConflict(): void {
    this.props = { ...this.props, syncStatus: 'conflict', updatedAt: new Date() };
  }

  /**
   * Deactivate the product.
   */
  deactivate(): void {
    this.props = { ...this.props, isActive: false, updatedAt: new Date() };
  }

  /**
   * Update product fields from remote sync data.
   * @param updates Fields to update from remote
   */
  updateFromSync(updates: SyncUpdateProps): void {
    const now = new Date();
    this.props = {
      ...this.props,
      productName: updates.productName ?? this.props.productName,
      unit: updates.unit !== undefined ? updates.unit : this.props.unit,
      category: updates.category !== undefined ? updates.category : this.props.category,
      brand: updates.brand !== undefined ? updates.brand : this.props.brand,
      updatedAt: now,
    };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns ProductProps
   */
  toProps(): ProductProps {
    return { ...this.props };
  }
}
