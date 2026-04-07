import { Product } from '../product.entity';
import { DomainError } from '../../shared/domain-error';

function createProduct(overrides?: Record<string, unknown>): Product {
  return Product.create({
    productCode: 'LOA-XM-OUTDOOR-30W',
    productName: 'Loa Bluetooth Xiaomi Sound Outdoor 30W',
    unit: 'cái',
    category: 'Loa Bluetooth',
    brand: 'Xiaomi',
    ...overrides,
  });
}

describe('Product', () => {
  describe('create', () => {
    it('should create product with valid props', () => {
      const product = createProduct();
      expect(product.id).toBeDefined();
      expect(product.productCode).toBe('LOA-XM-OUTDOOR-30W');
      expect(product.productName).toBe('Loa Bluetooth Xiaomi Sound Outdoor 30W');
      expect(product.isActive).toBe(true);
      expect(product.syncStatus).toBe('local_only');
    });

    it('should create with null optional fields', () => {
      const product = createProduct({ unit: null, category: null, brand: null });
      expect(product.unit).toBeNull();
      expect(product.category).toBeNull();
      expect(product.brand).toBeNull();
    });

    it('should throw DomainError when productCode is empty', () => {
      expect(() => createProduct({ productCode: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when productName is empty', () => {
      expect(() => createProduct({ productName: '' })).toThrow(DomainError);
    });
  });

  describe('markSynced', () => {
    it('should update sync status and timestamp', () => {
      const product = createProduct();
      product.markSynced('ext-123');
      expect(product.syncStatus).toBe('synced');
      expect(product.externalId).toBe('ext-123');
      expect(product.lastSyncedAt).toBeInstanceOf(Date);
    });
  });

  describe('markConflict', () => {
    it('should set sync status to conflict', () => {
      const product = createProduct();
      product.markSynced('ext-1');
      product.markConflict();
      expect(product.syncStatus).toBe('conflict');
    });
  });

  describe('deactivate', () => {
    it('should deactivate product', () => {
      const product = createProduct();
      product.deactivate();
      expect(product.isActive).toBe(false);
    });
  });

  describe('updateFromSync', () => {
    it('should update product fields from remote data', () => {
      const product = createProduct();
      product.updateFromSync({
        productName: 'Updated Name',
        unit: 'bộ',
        category: 'Updated Category',
        brand: 'Updated Brand',
      });
      expect(product.productName).toBe('Updated Name');
      expect(product.unit).toBe('bộ');
    });
  });

  describe('reconstitute', () => {
    it('should recreate from stored props', () => {
      const product = Product.reconstitute({
        id: 'prod-1',
        productCode: 'CODE-1',
        productName: 'Product 1',
        unit: null,
        category: null,
        brand: null,
        isActive: true,
        syncStatus: 'synced',
        externalId: 'ext-1',
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(product.id).toBe('prod-1');
      expect(product.syncStatus).toBe('synced');
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const product = createProduct({ id: 'prod-test' });
      const props = product.toProps();
      expect(props.id).toBe('prod-test');
      expect(props.productCode).toBe('LOA-XM-OUTDOOR-30W');
    });
  });
});
