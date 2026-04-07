import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { FingerprintRuleRepositoryImpl } from '../fingerprint-rule.repository.impl';
import { SchemaRepositoryImpl } from '../schema.repository.impl';
import { FingerprintRule } from '../../../../domain/schema/fingerprint-rule.entity';
import { Schema } from '../../../../domain/schema/schema.entity';

describe('FingerprintRuleRepositoryImpl', () => {
  let db: TestDB;
  let repo: FingerprintRuleRepositoryImpl;
  let schemaRepo: SchemaRepositoryImpl;

  beforeEach(async () => {
    db = createTestDb();
    repo = new FingerprintRuleRepositoryImpl(db);
    schemaRepo = new SchemaRepositoryImpl(db);

    // Create parent schema for FK reference
    const schema = Schema.create({
      id: 'schema-1',
      name: 'Test Schema',
      nccName: 'Supplier',
      nccTaxId: '0123456789',
    });
    await schemaRepo.save(schema);
  });

  describe('save + findBySchemaId roundtrip', () => {
    it('should save and retrieve rules by schema ID', async () => {
      const rule = FingerprintRule.create({
        id: 'rule-1',
        schemaId: 'schema-1',
        ruleType: 'mst_exact',
        pattern: '0123456789',
        priority: 10,
      });

      await repo.save(rule);
      const results = await repo.findBySchemaId('schema-1');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rule-1');
      expect(results[0].schemaId).toBe('schema-1');
      expect(results[0].ruleType).toBe('mst_exact');
      expect(results[0].pattern).toBe('0123456789');
      expect(results[0].priority).toBe(10);
      expect(results[0].isActive).toBe(true);
      expect(results[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findAllActive', () => {
    it('should return only active rules', async () => {
      const active = FingerprintRule.create({
        id: 'active-rule',
        schemaId: 'schema-1',
        ruleType: 'keyword',
        pattern: 'ABC',
        priority: 5,
      });

      const inactive = FingerprintRule.create({
        id: 'inactive-rule',
        schemaId: 'schema-1',
        ruleType: 'keyword',
        pattern: 'DEF',
        priority: 5,
      });
      inactive.deactivate();

      await repo.save(active);
      await repo.save(inactive);

      const results = await repo.findAllActive();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('active-rule');
    });
  });

  describe('upsert', () => {
    it('should update an existing rule', async () => {
      const rule = FingerprintRule.create({
        id: 'rule-up',
        schemaId: 'schema-1',
        ruleType: 'mst_exact',
        pattern: 'original',
        priority: 1,
      });
      await repo.save(rule);

      rule.deactivate();
      await repo.save(rule);

      const results = await repo.findBySchemaId('schema-1');
      expect(results[0].isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a rule', async () => {
      const rule = FingerprintRule.create({
        id: 'rule-del',
        schemaId: 'schema-1',
        ruleType: 'keyword',
        pattern: 'test',
        priority: 0,
      });
      await repo.save(rule);

      await repo.delete('rule-del');
      const results = await repo.findBySchemaId('schema-1');
      expect(results).toHaveLength(0);
    });
  });

  describe('empty result', () => {
    it('should return empty array for schema with no rules', async () => {
      const results = await repo.findBySchemaId('schema-1');
      expect(results).toHaveLength(0);
    });
  });
});
