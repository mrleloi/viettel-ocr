import { ViettelProductClient } from '../viettel-product.client';

// Mock fetch globally
const mockFetch = jest.fn();
(global as Record<string, unknown>).fetch = mockFetch;

function createMockConfigService(overrides: Partial<{ viettelProductApiUrl: string }> = {}) {
  return {
    viettelProductApiUrl: overrides.viettelProductApiUrl ?? 'http://localhost:3002',
  };
}

function createProductPage(
  products: Array<{ id: string; productCode: string; productName: string; category: string; brand: string }>,
  page: number,
  totalPages: number,
  total: number,
) {
  return {
    data: products,
    pagination: { page, limit: 20, total, totalPages },
  };
}

describe('ViettelProductClient', () => {
  let client: ViettelProductClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ViettelProductClient(createMockConfigService() as never);
  });

  describe('fetchProducts', () => {
    it('should return paginated products', async () => {
      const page = createProductPage(
        [
          { id: 'P001', productCode: 'VT-LAP-001', productName: 'Laptop Dell', category: 'Laptop', brand: 'Dell' },
          { id: 'P002', productCode: 'VT-LAP-002', productName: 'Laptop HP', category: 'Laptop', brand: 'HP' },
        ],
        1,
        1,
        2,
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => page,
      });

      const result = await client.fetchProducts();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].productCode).toBe('VT-LAP-001');
      expect(result.data[0].productName).toBe('Laptop Dell');
      expect(result.pagination.total).toBe(2);
    });

    it('should pass search/page/limit query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createProductPage([], 2, 3, 50),
      });

      await client.fetchProducts(2, 10, 'Dell');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
      expect(url).toContain('search=Dell');
    });

    it('should throw with descriptive error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(client.fetchProducts()).rejects.toThrow(/ECONNREFUSED/);
    });

    it('should throw on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(client.fetchProducts()).rejects.toThrow(/503/);
    });
  });

  describe('fetchAllProducts', () => {
    it('should paginate through all pages automatically', async () => {
      const page1 = createProductPage(
        [{ id: 'P001', productCode: 'VT-001', productName: 'Product 1', category: 'A', brand: 'X' }],
        1,
        2,
        2,
      );
      const page2 = createProductPage(
        [{ id: 'P002', productCode: 'VT-002', productName: 'Product 2', category: 'B', brand: 'Y' }],
        2,
        2,
        2,
      );

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => page2,
        });

      const result = await client.fetchAllProducts();

      expect(result).toHaveLength(2);
      expect(result[0].productCode).toBe('VT-001');
      expect(result[1].productCode).toBe('VT-002');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle single page result', async () => {
      const page1 = createProductPage(
        [{ id: 'P001', productCode: 'VT-001', productName: 'Product 1', category: 'A', brand: 'X' }],
        1,
        1,
        1,
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => page1,
      });

      const result = await client.fetchAllProducts();

      expect(result).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API responds with 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/health');
    });

    it('should return false when API is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it('should return false when API responds with non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});
