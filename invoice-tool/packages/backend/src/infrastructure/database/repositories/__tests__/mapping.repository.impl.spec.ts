import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { MappingRepositoryImpl } from '../mapping.repository.impl';
import { SchemaRepositoryImpl } from '../schema.repository.impl';
import { ProductRepositoryImpl } from '../product.repository.impl';
import { Mapping } from '../../../../domain/mapping/mapping.entity';
import { Schema } from '../../../../domain/schema/schema.entity';
import { Product } from '../../../../domain/product/product.entity';

describe('MappingRepositoryImpl', () => {
  let db: TestDB;
  let repo: MappingRepositoryImpl;
  let schemaRepo: SchemaRepositoryImpl;

  beforeEach(async () => {
    db = createTestDb();
    repo = new MappingRepositoryImpl(db);
    schemaRepo = new SchemaRepositoryImpl(db);

    const schema = Schema.create({
      id: 'schema-1',
      name: 'Test Schema',
      nccName: 'Supplier',
      nccTaxId: '0123456789',
    });
    await schemaRepo.save(schema);

    // Create product for FK reference (used by linkToViettelProduct)
    const productRepo = new ProductRepositoryImpl(db);
    const product = Product.create({
      id: 'vt-1',
      productCode: 'VT-001',
      productName: 'Viettel Product',
    });
    await productRepo.save(product);
  });

  describe('save + findByPartnerName roundtrip', () => {
    it('should save and find mapping by partner name and schema', async () => {
      const mapping = Mapping.create({
        id: 'mapping-1',
        schemaId: 'schema-1',
        partnerProductName: 'Cáp quang ODF 24 core',
        partnerProductCode: 'P-001',
        viettelProductId: null,
        source: 'manual',
        confidence: 0.95,
      });

      await repo.save(mapping);
      const found = await repo.findByPartnerName('Cáp quang ODF 24 core', 'schema-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('mapping-1');
      expect(found!.partnerProductName).toBe('Cáp quang ODF 24 core');
      expect(found!.partnerProductCode).toBe('P-001');
      expect(found!.status).toBe('active');
      expect(found!.source).toBe('manual');
      expect(found!.confidence).toBe(0.95);
      expect(found!.usageCount).toBe(0);
      expect(found!.lastUsedAt).toBeNull();
      expect(found!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findByPartnerName returns null when not found', () => {
    it('should return null for non-existent partner name', async () => {
      const found = await repo.findByPartnerName('nonexistent', 'schema-1');
      expect(found).toBeNull();
    });
  });

  describe('findBySchemaId', () => {
    it('should find all mappings for a schema', async () => {
      await repo.save(Mapping.create({
        id: 'm1', schemaId: 'schema-1', partnerProductName: 'Product A', source: 'manual',
      }));
      await repo.save(Mapping.create({
        id: 'm2', schemaId: 'schema-1', partnerProductName: 'Product B', source: 'manual',
      }));

      const results = await repo.findBySchemaId('schema-1');
      expect(results).toHaveLength(2);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count and set lastUsedAt', async () => {
      const mapping = Mapping.create({
        id: 'mapping-inc',
        schemaId: 'schema-1',
        partnerProductName: 'Usage Test',
        source: 'manual',
      });
      await repo.save(mapping);

      await repo.incrementUsage('mapping-inc');
      await repo.incrementUsage('mapping-inc');

      const found = await repo.findByPartnerName('Usage Test', 'schema-1');
      expect(found!.usageCount).toBe(2);
      expect(found!.lastUsedAt).toBeInstanceOf(Date);
    });
  });

  describe('upsert', () => {
    it('should update an existing mapping', async () => {
      const mapping = Mapping.create({
        id: 'mapping-up',
        schemaId: 'schema-1',
        partnerProductName: 'Upsert Test',
        source: 'manual',
      });
      await repo.save(mapping);

      mapping.linkToViettelProduct('vt-1', 'VT-001', 'Viettel Product');
      await repo.save(mapping);

      const found = await repo.findByPartnerName('Upsert Test', 'schema-1');
      expect(found!.viettelProductId).toBe('vt-1');
      expect(found!.viettelProductCode).toBe('VT-001');
      expect(found!.viettelProductName).toBe('Viettel Product');
    });
  });

  describe('auto_learned mapping status', () => {
    it('should create auto_learned mapping with pending_review status', async () => {
      const mapping = Mapping.create({
        id: 'mapping-auto',
        schemaId: 'schema-1',
        partnerProductName: 'Auto Learned',
        source: 'auto_learned',
        confidence: 0.75,
      });
      await repo.save(mapping);

      const found = await repo.findByPartnerName('Auto Learned', 'schema-1');
      expect(found!.status).toBe('pending_review');
      expect(found!.source).toBe('auto_learned');
    });
  });
});
