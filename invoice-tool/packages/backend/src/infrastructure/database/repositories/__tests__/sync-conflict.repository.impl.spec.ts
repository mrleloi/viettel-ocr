import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { SyncConflictRepositoryImpl } from '../sync-conflict.repository.impl';
import { ProductRepositoryImpl } from '../product.repository.impl';
import { SyncConflict } from '../../../../domain/product/sync-conflict.entity';
import { Product } from '../../../../domain/product/product.entity';

describe('SyncConflictRepositoryImpl', () => {
  let db: TestDB;
  let repo: SyncConflictRepositoryImpl;
  let productRepo: ProductRepositoryImpl;

  beforeEach(async () => {
    db = createTestDb();
    repo = new SyncConflictRepositoryImpl(db);
    productRepo = new ProductRepositoryImpl(db);

    // Create parent product for FK reference
    const product = Product.create({
      id: 'product-1',
      productCode: 'VT-001',
      productName: 'Test Product',
    });
    await productRepo.save(product);
  });

  describe('save + findUnresolved roundtrip', () => {
    it('should save and retrieve unresolved conflicts', async () => {
      const conflict = SyncConflict.create({
        id: 'conflict-1',
        productId: 'product-1',
        fieldName: 'productName',
        localValue: 'Local Name',
        remoteValue: 'Remote Name',
      });

      await repo.save(conflict);
      const results = await repo.findUnresolved();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('conflict-1');
      expect(results[0].productId).toBe('product-1');
      expect(results[0].fieldName).toBe('productName');
      expect(results[0].localValue).toBe('Local Name');
      expect(results[0].remoteValue).toBe('Remote Name');
      expect(results[0].resolvedAt).toBeNull();
      expect(results[0].resolvedAction).toBeNull();
      expect(results[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('resolve', () => {
    it('should resolve a conflict with keep_local', async () => {
      const conflict = SyncConflict.create({
        id: 'conflict-resolve',
        productId: 'product-1',
        fieldName: 'unit',
        localValue: 'Sợi',
        remoteValue: 'Cuộn',
      });
      await repo.save(conflict);

      await repo.resolve('conflict-resolve', 'keep_local');

      const unresolved = await repo.findUnresolved();
      expect(unresolved).toHaveLength(0);
    });

    it('should resolve a conflict with accept_remote', async () => {
      const conflict = SyncConflict.create({
        id: 'conflict-accept',
        productId: 'product-1',
        fieldName: 'category',
        localValue: 'A',
        remoteValue: 'B',
      });
      await repo.save(conflict);

      await repo.resolve('conflict-accept', 'accept_remote');

      const unresolved = await repo.findUnresolved();
      expect(unresolved).toHaveLength(0);
    });
  });

  describe('findUnresolved excludes resolved', () => {
    it('should not return resolved conflicts', async () => {
      const unresolved = SyncConflict.create({
        id: 'c-unresolved',
        productId: 'product-1',
        fieldName: 'brand',
        localValue: 'X',
        remoteValue: 'Y',
      });
      const resolved = SyncConflict.create({
        id: 'c-resolved',
        productId: 'product-1',
        fieldName: 'unit',
        localValue: 'A',
        remoteValue: 'B',
      });

      await repo.save(unresolved);
      await repo.save(resolved);
      await repo.resolve('c-resolved', 'keep_local');

      const results = await repo.findUnresolved();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('c-unresolved');
    });
  });

  describe('upsert', () => {
    it('should update an existing conflict via save', async () => {
      const conflict = SyncConflict.create({
        id: 'conflict-up',
        productId: 'product-1',
        fieldName: 'name',
        localValue: 'old',
        remoteValue: 'new',
      });
      await repo.save(conflict);

      conflict.resolveKeepLocal();
      await repo.save(conflict);

      const unresolved = await repo.findUnresolved();
      expect(unresolved).toHaveLength(0);
    });
  });
});
