import type { Product } from './product.entity';

/**
 * Repository interface for Product aggregate persistence.
 * Implementations live in infrastructure layer.
 */
export interface IProductRepository {
  /**
   * Find a product by its unique ID.
   * @param id Product ID
   * @returns The Product if found, null otherwise
   */
  findById(id: string): Promise<Product | null>;

  /**
   * Find a product by its product code.
   * @param code Viettel product code
   * @returns The Product if found, null otherwise
   */
  findByCode(code: string): Promise<Product | null>;

  /**
   * Find all products.
   * @returns Array of all products
   */
  findAll(): Promise<Product[]>;

  /**
   * Search products by name or code (partial match).
   * @param query Search query string
   * @returns Array of matching products
   */
  search(query: string): Promise<Product[]>;

  /**
   * Persist a product (insert or update).
   * @param product Product entity to save
   */
  save(product: Product): Promise<void>;
}
