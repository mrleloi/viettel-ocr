/**
 * A single product item returned from the external Viettel Product API.
 */
export interface ProductApiItem {
  /** Product code (unique identifier from external API) */
  productCode: string;
  /** Product display name */
  productName: string;
  /** Product category */
  category: string;
  /** Product status (e.g., 'active', 'inactive') */
  status: string;
  /** Raw API data for audit trail */
  rawData: Record<string, unknown>;
}

/**
 * Paginated response from the external Viettel Product API.
 */
export interface ProductApiResponse {
  /** List of products on this page */
  data: ProductApiItem[];
  /** Pagination metadata */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Domain port interface for the Viettel Product external API client.
 *
 * Infrastructure implementations (e.g., ViettelProductClient) provide
 * the concrete HTTP integration. Domain layer depends only on this interface.
 */
export interface IProductApiClient {
  /**
   * Fetch products from external API with pagination.
   * @param page - Page number (1-based). Defaults to 1.
   * @param limit - Items per page. Defaults to 20.
   * @param search - Optional search keyword filter.
   * @returns Paginated product response
   */
  fetchProducts(page?: number, limit?: number, search?: string): Promise<ProductApiResponse>;

  /**
   * Fetch all products across all pages.
   * Automatically paginates through the entire dataset.
   * @returns All products from the API
   */
  fetchAllProducts(): Promise<ProductApiItem[]>;

  /**
   * Check if the external API is reachable.
   * @returns true if the API responds successfully
   */
  healthCheck(): Promise<boolean>;
}
