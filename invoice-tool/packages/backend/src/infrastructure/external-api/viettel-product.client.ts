import { Injectable } from '@nestjs/common';
import {
  IProductApiClient,
  ProductApiItem,
  ProductApiResponse,
} from '../../domain/product/product-api.client';
import { EnvConfigService } from '../config/env-config.service';

/**
 * Raw product shape returned by the Viettel Product API.
 */
interface RawApiProduct {
  id: string;
  productCode: string;
  productName: string;
  unit?: string;
  category: string;
  brand?: string;
  status?: string;
}

/**
 * Raw paginated API response shape.
 */
interface RawApiResponse {
  data: RawApiProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Viettel Product API client implementing the IProductApiClient domain port.
 *
 * Fetches product data from the configured external API (or mock server)
 * with pagination and search support.
 */
@Injectable()
export class ViettelProductClient implements IProductApiClient {
  constructor(
    private readonly config: EnvConfigService,
  ) {}

  /**
   * Fetch products from external API with pagination.
   * @param page - Page number (1-based). Defaults to 1.
   * @param limit - Items per page. Defaults to 20.
   * @param search - Optional search keyword filter.
   * @returns Paginated product response
   */
  async fetchProducts(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<ProductApiResponse> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) {
      params.set('search', search);
    }

    const url = `${this.config.viettelProductApiUrl}/products?${params.toString()}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';
      throw new Error(
        `Viettel Product API unreachable at ${this.config.viettelProductApiUrl}: ${message}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Viettel Product API error: ${response.status} ${response.statusText}`,
      );
    }

    const raw = (await response.json()) as RawApiResponse;

    return {
      data: raw.data.map((item) => this.mapToProductApiItem(item)),
      pagination: raw.pagination,
    };
  }

  /**
   * Fetch all products across all pages.
   * Automatically paginates through the entire dataset.
   * @returns All products from the API
   */
  async fetchAllProducts(): Promise<ProductApiItem[]> {
    const allProducts: ProductApiItem[] = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      const response = await this.fetchProducts(currentPage, 100);
      allProducts.push(...response.data);
      totalPages = response.pagination.totalPages;
      currentPage++;
    } while (currentPage <= totalPages);

    return allProducts;
  }

  /**
   * Check if the external API is reachable.
   * @returns true if the API responds successfully
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.config.viettelProductApiUrl}/health`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Map raw API product to domain ProductApiItem.
   * @param raw - Raw API product data
   * @returns Mapped ProductApiItem
   */
  private mapToProductApiItem(raw: RawApiProduct): ProductApiItem {
    return {
      productCode: raw.productCode,
      productName: raw.productName,
      category: raw.category,
      status: raw.status ?? 'active',
      rawData: raw as unknown as Record<string, unknown>,
    };
  }
}
