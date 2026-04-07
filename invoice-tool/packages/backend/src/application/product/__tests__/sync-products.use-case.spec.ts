import { SyncProductsUseCase } from '../sync-products.use-case';
import type { IProductRepository } from '../../../domain/product/product.repository';
import type { ISyncConflictRepository } from '../../../domain/product/sync-conflict.repository';
import type { IProductApiClient, ProductApiItem } from '../../../domain/product/product-api.client';
import { Product } from '../../../domain/product/product.entity';

function createApiProduct(overrides?: Partial<ProductApiItem>): ProductApiItem {
  return {
    productCode: overrides?.productCode ?? 'VT-001',
    productName: overrides?.productName ?? 'Test Product',
    category: overrides?.category ?? 'Electronics',
    status: overrides?.status ?? 'active',
    rawData: overrides?.rawData ?? {},
  };
}

function createLocalProduct(code: string, name: string, category?: string): Product {
  const product = Product.create({
    productCode: code,
    productName: name,
    category: category ?? 'Electronics',
  });
  product.markSynced(`ext-${code}`);
  return product;
}

describe('SyncProductsUseCase', () => {
  let sut: SyncProductsUseCase;
  let productRepo: jest.Mocked<IProductRepository>;
  let conflictRepo: jest.Mocked<ISyncConflictRepository>;
  let apiClient: jest.Mocked<IProductApiClient>;

  beforeEach(() => {
    productRepo = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      search: jest.fn(),
    };
    conflictRepo = {
      findUnresolved: jest.fn(),
      save: jest.fn(),
      resolve: jest.fn(),
    };
    apiClient = {
      fetchProducts: jest.fn(),
      fetchAllProducts: jest.fn(),
      healthCheck: jest.fn(),
    };
    sut = new SyncProductsUseCase(productRepo, conflictRepo, apiClient);
  });

  describe('execute', () => {
    it('should create new products from API', async () => {
      apiClient.fetchAllProducts.mockResolvedValue([
        createApiProduct({ productCode: 'VT-001', productName: 'Phone A' }),
        createApiProduct({ productCode: 'VT-002', productName: 'Phone B' }),
      ]);
      productRepo.findByCode.mockResolvedValue(null);

      const result = await sut.execute();

      expect(result.totalFetched).toBe(2);
      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.conflictsDetected).toBe(0);
      expect(productRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should update existing products when data changed', async () => {
      const existing = createLocalProduct('VT-001', 'Old Name');
      apiClient.fetchAllProducts.mockResolvedValue([
        createApiProduct({ productCode: 'VT-001', productName: 'New Name' }),
      ]);
      productRepo.findByCode.mockResolvedValue(existing);

      const result = await sut.execute();

      expect(result.totalFetched).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('should not update when data is identical (idempotent)', async () => {
      const existing = createLocalProduct('VT-001', 'Same Name', 'Electronics');
      apiClient.fetchAllProducts.mockResolvedValue([
        createApiProduct({ productCode: 'VT-001', productName: 'Same Name', category: 'Electronics' }),
      ]);
      productRepo.findByCode.mockResolvedValue(existing);

      const result = await sut.execute();

      expect(result.updated).toBe(0);
      expect(result.created).toBe(0);
      expect(result.conflictsDetected).toBe(0);
    });

    it('should throw when API fetch fails', async () => {
      apiClient.fetchAllProducts.mockRejectedValue(new Error('Network timeout'));

      await expect(sut.execute()).rejects.toThrow('Failed to fetch products from API: Network timeout');
    });

    it('should handle empty API response', async () => {
      apiClient.fetchAllProducts.mockResolvedValue([]);

      const result = await sut.execute();

      expect(result.totalFetched).toBe(0);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });
});
