import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { SchemaRepositoryImpl } from '../schema.repository.impl';
import { Schema } from '../../../../domain/schema/schema.entity';

describe('SchemaRepositoryImpl', () => {
  let db: TestDB;
  let repo: SchemaRepositoryImpl;

  beforeEach(() => {
    db = createTestDb();
    repo = new SchemaRepositoryImpl(db);
  });

  describe('save + findById roundtrip', () => {
    it('should save and retrieve a schema', async () => {
      const schema = Schema.create({
        id: 'schema-1',
        name: 'Test Schema',
        description: 'A test schema',
        nccName: 'Supplier Co',
        nccTaxId: '0123456789',
        promptTemplate: 'Extract fields: {fields}',
        behaviorConfig: '{"autoApprove": true}',
      });

      await repo.save(schema);
      const found = await repo.findById('schema-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('schema-1');
      expect(found!.name).toBe('Test Schema');
      expect(found!.description).toBe('A test schema');
      expect(found!.nccName).toBe('Supplier Co');
      expect(found!.nccTaxId).toBe('0123456789');
      expect(found!.status).toBe('draft');
      expect(found!.promptTemplate).toBe('Extract fields: {fields}');
      expect(found!.behaviorConfig).toBe('{"autoApprove": true}');
      expect(found!.version).toBe(1);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findById returns null when not found', () => {
    it('should return null for non-existent ID', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('save existing entity (upsert)', () => {
    it('should update an existing schema', async () => {
      const schema = Schema.create({
        id: 'schema-1',
        name: 'Original Name',
        nccName: 'Supplier Co',
        nccTaxId: '0123456789',
      });
      await repo.save(schema);

      schema.updateInfo({ name: 'Updated Name' });
      await repo.save(schema);

      const found = await repo.findById('schema-1');
      expect(found!.name).toBe('Updated Name');
    });
  });

  describe('findActive', () => {
    it('should return only active schemas', async () => {
      const active = Schema.create({
        id: 'active-1',
        name: 'Active Schema',
        nccName: 'Supplier A',
        nccTaxId: '1111111111',
      });
      active.activate();

      const draft = Schema.create({
        id: 'draft-1',
        name: 'Draft Schema',
        nccName: 'Supplier B',
        nccTaxId: '2222222222',
      });

      await repo.save(active);
      await repo.save(draft);

      const results = await repo.findActive();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('active-1');
      expect(results[0].status).toBe('active');
    });
  });

  describe('findByNccTaxId', () => {
    it('should find schema by NCC tax ID', async () => {
      const schema = Schema.create({
        id: 'schema-tax',
        name: 'Tax Schema',
        nccName: 'Supplier Tax',
        nccTaxId: '9876543210',
      });
      await repo.save(schema);

      const found = await repo.findByNccTaxId('9876543210');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('schema-tax');
    });

    it('should return null for non-existent tax ID', async () => {
      const found = await repo.findByNccTaxId('0000000000');
      expect(found).toBeNull();
    });
  });

  describe('nullable fields', () => {
    it('should handle null description and optional fields', async () => {
      const schema = Schema.create({
        id: 'schema-null',
        name: 'Null Schema',
        nccName: 'Supplier',
        nccTaxId: '1234567890',
      });
      await repo.save(schema);

      const found = await repo.findById('schema-null');
      expect(found!.description).toBeNull();
      expect(found!.promptTemplate).toBeNull();
      expect(found!.behaviorConfig).toBeNull();
    });
  });
});
