import { Injectable, Inject } from '@nestjs/common';
import { eq, or, like } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { DATABASE_TOKEN } from '../connection';
import { products } from '../schema';
import type { IProductRepository } from '../../../domain/product/product.repository';
import { Product } from '../../../domain/product/product.entity';
import type { ProductProps, ProductSyncStatus } from '@invoice-tool/shared';

/**
 * Drizzle + SQLite implementation of IProductRepository.
 */
@Injectable()
export class ProductRepositoryImpl implements IProductRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: AppDatabase) {}

  /**
   * Find a product by its unique ID.
   * @param id Product ID
   * @returns The Product if found, null otherwise
   */
  async findById(id: string): Promise<Product | null> {
    const row = await this.db.select().from(products).where(eq(products.id, id)).get();
    if (!row) return null;
    return Product.reconstitute(this.toDomain(row));
  }

  /**
   * Find a product by its product code.
   * @param code Viettel product code
   * @returns The Product if found, null otherwise
   */
  async findByCode(code: string): Promise<Product | null> {
    const row = await this.db.select().from(products).where(eq(products.productCode, code)).get();
    if (!row) return null;
    return Product.reconstitute(this.toDomain(row));
  }

  /**
   * Find all products.
   * @returns Array of all products
   */
  async findAll(): Promise<Product[]> {
    const rows = await this.db.select().from(products).all();
    return rows.map((row) => Product.reconstitute(this.toDomain(row)));
  }

  /**
   * Search products by name or code (partial match).
   * @param query Search query string
   * @returns Array of matching products
   */
  async search(query: string): Promise<Product[]> {
    const pattern = `%${query}%`;
    const rows = await this.db.select().from(products)
      .where(or(
        like(products.productName, pattern),
        like(products.productCode, pattern),
      ))
      .all();
    return rows.map((row) => Product.reconstitute(this.toDomain(row)));
  }

  /**
   * Persist a product (insert or update).
   * @param product Product entity to save
   */
  async save(product: Product): Promise<void> {
    const data = this.toPersistence(product);
    await this.db.insert(products).values(data)
      .onConflictDoUpdate({ target: products.id, set: data });
  }

  /**
   * Map a DB row to domain props.
   * @param row Database row
   * @returns ProductProps for reconstitution
   */
  private toDomain(row: typeof products.$inferSelect): ProductProps {
    return {
      id: row.id,
      productCode: row.productCode,
      productName: row.productName,
      unit: row.unit ?? null,
      category: row.category ?? null,
      brand: row.brand ?? null,
      isActive: row.isActive,
      syncStatus: row.syncStatus as ProductSyncStatus,
      externalId: row.externalId ?? null,
      lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  /**
   * Map a domain entity to persistence values.
   * @param entity Product entity
   * @returns Insert/update values
   */
  private toPersistence(entity: Product): typeof products.$inferInsert {
    return {
      id: entity.id,
      productCode: entity.productCode,
      productName: entity.productName,
      unit: entity.unit,
      category: entity.category,
      brand: entity.brand,
      isActive: entity.isActive,
      syncStatus: entity.syncStatus,
      externalId: entity.externalId,
      lastSyncedAt: entity.lastSyncedAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
