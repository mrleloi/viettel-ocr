import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { ProductRepositoryImpl } from '../product.repository.impl';
import { Product } from '../../../../domain/product/product.entity';

describe('ProductRepositoryImpl', () => {
  let db: TestDB;
  let repo: ProductRepositoryImpl;

  beforeEach(() => {
    db = createTestDb();
    repo = new ProductRepositoryImpl(db);
  });

  describe('save + findById roundtrip', () => {
    it('should save and retrieve a product', async () => {
      const product = Product.create({
        id: 'prod-1',
        productCode: 'VT-001',
        productName: 'Cáp quang',
        unit: 'Sợi',
        category: 'Hạ tầng',
        brand: 'Viettel',
      });

      await repo.save(product);
      const found = await repo.findById('prod-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('prod-1');
      expect(found!.productCode).toBe('VT-001');
      expect(found!.productName).toBe('Cáp quang');
      expect(found!.unit).toBe('Sợi');
      expect(found!.category).toBe('Hạ tầng');
      expect(found!.brand).toBe('Viettel');
      expect(found!.isActive).toBe(true);
      expect(found!.syncStatus).toBe('local_only');
      expect(found!.externalId).toBeNull();
      expect(found!.lastSyncedAt).toBeNull();
      expect(found!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findById returns null when not found', () => {
    it('should return null for non-existent ID', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('should find product by code', async () => {
      const product = Product.create({
        id: 'prod-code',
        productCode: 'VT-999',
        productName: 'Test Product',
      });
      await repo.save(product);

      const found = await repo.findByCode('VT-999');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('prod-code');
    });

    it('should return null for non-existent code', async () => {
      const found = await repo.findByCode('NONE');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all products', async () => {
      await repo.save(Product.create({ id: 'p1', productCode: 'C1', productName: 'Product 1' }));
      await repo.save(Product.create({ id: 'p2', productCode: 'C2', productName: 'Product 2' }));
      await repo.save(Product.create({ id: 'p3', productCode: 'C3', productName: 'Product 3' }));

      const results = await repo.findAll();
      expect(results).toHaveLength(3);
    });
  });

  describe('search', () => {
    it('should search by product name (partial match)', async () => {
      await repo.save(Product.create({ id: 'p1', productCode: 'C1', productName: 'Cáp quang ODF' }));
      await repo.save(Product.create({ id: 'p2', productCode: 'C2', productName: 'Switch 24 port' }));
      await repo.save(Product.create({ id: 'p3', productCode: 'C3', productName: 'Cáp đồng' }));

      const results = await repo.search('Cáp');
      expect(results).toHaveLength(2);
    });

    it('should search by product code (partial match)', async () => {
      await repo.save(Product.create({ id: 'p1', productCode: 'VT-001', productName: 'Prod A' }));
      await repo.save(Product.create({ id: 'p2', productCode: 'VT-002', productName: 'Prod B' }));
      await repo.save(Product.create({ id: 'p3', productCode: 'XX-001', productName: 'Prod C' }));

      const results = await repo.search('VT-');
      expect(results).toHaveLength(2);
    });
  });

  describe('upsert', () => {
    it('should update product on re-save', async () => {
      const product = Product.create({
        id: 'prod-up',
        productCode: 'VT-UP',
        productName: 'Original',
      });
      await repo.save(product);

      product.markSynced('ext-123');
      await repo.save(product);

      const found = await repo.findById('prod-up');
      expect(found!.syncStatus).toBe('synced');
      expect(found!.externalId).toBe('ext-123');
      expect(found!.lastSyncedAt).toBeInstanceOf(Date);
    });
  });
});
