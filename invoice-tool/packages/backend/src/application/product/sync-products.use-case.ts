import type { IProductRepository } from '../../domain/product/product.repository';
import type { ISyncConflictRepository } from '../../domain/product/sync-conflict.repository';
import type { IProductApiClient, ProductApiItem } from '../../domain/product/product-api.client';
import { Product } from '../../domain/product/product.entity';
import { SyncConflict } from '../../domain/product/sync-conflict.entity';
import { Injectable, Inject } from '@nestjs/common';

/** Output after product sync */
export interface SyncProductsOutput {
  /** Total products fetched from API */
  readonly totalFetched: number;
  /** New products created locally */
  readonly created: number;
  /** Existing products updated */
  readonly updated: number;
  /** Conflicts detected (local edits differ from API) */
  readonly conflictsDetected: number;
}

/**
 * SyncProductsUseCase — fetches products from Viettel API and syncs locally.
 *
 * Orchestrates:
 * 1. Fetch all products from external API
 * 2. For each product: check if exists locally
 * 3. New products → create
 * 4. Existing products with changes → update (or create conflict)
 * 5. Persist all changes
 */
@Injectable()
export class SyncProductsUseCase {
  constructor(
    @Inject('IProductRepository') private readonly productRepo: IProductRepository,
    @Inject('ISyncConflictRepository') private readonly conflictRepo: ISyncConflictRepository,
    @Inject('IProductApiClient') private readonly apiClient: IProductApiClient,
  ) {}

  /**
   * Execute the product sync flow.
   * @returns Sync result with counts
   */
  async execute(): Promise<SyncProductsOutput> {
    // Fetch all products from external API
    let apiProducts: ProductApiItem[];
    try {
      apiProducts = await this.apiClient.fetchAllProducts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch products from API: ${message}`);
    }

    let created = 0;
    let updated = 0;
    let conflictsDetected = 0;

    for (const apiProduct of apiProducts) {
      const existingProduct = await this.productRepo.findByCode(apiProduct.productCode);

      if (!existingProduct) {
        // New product — create
        const newProduct = Product.create({
          productCode: apiProduct.productCode,
          productName: apiProduct.productName,
          category: apiProduct.category,
        });
        newProduct.markSynced(apiProduct.productCode);
        await this.productRepo.save(newProduct);
        created++;
      } else {
        // Existing product — check for changes
        const hasChanges = this.detectChanges(existingProduct, apiProduct);
        if (!hasChanges) {
          // No changes, just mark as synced
          existingProduct.markSynced(apiProduct.productCode);
          await this.productRepo.save(existingProduct);
          continue;
        }

        // Check for conflicts (local was manually edited)
        if (existingProduct.syncStatus === 'conflict' || existingProduct.syncStatus === 'local_only') {
          // Detect field-level conflicts
          const conflicts = this.buildConflicts(existingProduct, apiProduct);
          for (const conflict of conflicts) {
            await this.conflictRepo.save(conflict);
          }
          existingProduct.markConflict();
          await this.productRepo.save(existingProduct);
          conflictsDetected += conflicts.length;
        } else {
          // No local edits — safe to update
          existingProduct.updateFromSync({
            productName: apiProduct.productName,
            category: apiProduct.category,
          });
          existingProduct.markSynced(apiProduct.productCode);
          await this.productRepo.save(existingProduct);
          updated++;
        }
      }
    }

    return {
      totalFetched: apiProducts.length,
      created,
      updated,
      conflictsDetected,
    };
  }

  /**
   * Detect if API data differs from local product.
   * @param local - Local product entity
   * @param remote - API product data
   * @returns true if there are differences
   */
  private detectChanges(local: Product, remote: ProductApiItem): boolean {
    return (
      local.productName !== remote.productName ||
      local.category !== remote.category
    );
  }

  /**
   * Build SyncConflict entities for fields that differ.
   * @param local - Local product entity
   * @param remote - API product data
   * @returns Array of SyncConflict entities
   */
  private buildConflicts(local: Product, remote: ProductApiItem): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    if (local.productName !== remote.productName) {
      conflicts.push(SyncConflict.create({
        productId: local.id,
        fieldName: 'productName',
        localValue: local.productName,
        remoteValue: remote.productName,
      }));
    }

    if (local.category !== remote.category) {
      conflicts.push(SyncConflict.create({
        productId: local.id,
        fieldName: 'category',
        localValue: local.category ?? '',
        remoteValue: remote.category,
      }));
    }

    return conflicts;
  }
}
