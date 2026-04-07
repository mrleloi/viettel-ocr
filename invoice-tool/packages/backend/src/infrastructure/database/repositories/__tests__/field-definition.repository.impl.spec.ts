import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { FieldDefinitionRepositoryImpl } from '../field-definition.repository.impl';
import { SchemaRepositoryImpl } from '../schema.repository.impl';
import { FieldDefinition } from '../../../../domain/schema/field-definition.entity';
import { Schema } from '../../../../domain/schema/schema.entity';

describe('FieldDefinitionRepositoryImpl', () => {
  let db: TestDB;
  let repo: FieldDefinitionRepositoryImpl;
  let schemaRepo: SchemaRepositoryImpl;

  beforeEach(async () => {
    db = createTestDb();
    repo = new FieldDefinitionRepositoryImpl(db);
    schemaRepo = new SchemaRepositoryImpl(db);

    const schema = Schema.create({
      id: 'schema-1',
      name: 'Test Schema',
      nccName: 'Supplier',
      nccTaxId: '0123456789',
    });
    await schemaRepo.save(schema);
  });

  describe('save + findBySchemaId roundtrip', () => {
    it('should save and retrieve field definitions', async () => {
      const field = FieldDefinition.create({
        id: 'field-1',
        schemaId: 'schema-1',
        fieldName: 'invoice_number',
        displayName: 'Số hóa đơn',
        dataType: 'string',
        isRequired: true,
        validationRules: '{"pattern": "^[A-Z0-9]+$"}',
        extractionHint: 'Look for the number after "Số"',
        sortOrder: 1,
      });

      await repo.save(field);
      const results = await repo.findBySchemaId('schema-1');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('field-1');
      expect(results[0].fieldName).toBe('invoice_number');
      expect(results[0].displayName).toBe('Số hóa đơn');
      expect(results[0].dataType).toBe('string');
      expect(results[0].isRequired).toBe(true);
      expect(results[0].validationRules).toBe('{"pattern": "^[A-Z0-9]+$"}');
      expect(results[0].extractionHint).toBe('Look for the number after "Số"');
      expect(results[0].sortOrder).toBe(1);
    });
  });

  describe('sortOrder ordering', () => {
    it('should return field definitions ordered by sortOrder', async () => {
      const field3 = FieldDefinition.create({
        id: 'field-3',
        schemaId: 'schema-1',
        fieldName: 'total',
        displayName: 'Tổng tiền',
        dataType: 'number',
        isRequired: false,
        sortOrder: 3,
      });
      const field1 = FieldDefinition.create({
        id: 'field-1',
        schemaId: 'schema-1',
        fieldName: 'number',
        displayName: 'Số',
        dataType: 'string',
        isRequired: true,
        sortOrder: 1,
      });
      const field2 = FieldDefinition.create({
        id: 'field-2',
        schemaId: 'schema-1',
        fieldName: 'date',
        displayName: 'Ngày',
        dataType: 'date',
        isRequired: true,
        sortOrder: 2,
      });

      // Save in non-sorted order
      await repo.save(field3);
      await repo.save(field1);
      await repo.save(field2);

      const results = await repo.findBySchemaId('schema-1');
      expect(results).toHaveLength(3);
      expect(results[0].sortOrder).toBe(1);
      expect(results[1].sortOrder).toBe(2);
      expect(results[2].sortOrder).toBe(3);
    });
  });

  describe('upsert', () => {
    it('should update an existing field definition', async () => {
      const field = FieldDefinition.create({
        id: 'field-up',
        schemaId: 'schema-1',
        fieldName: 'amount',
        displayName: 'Original',
        dataType: 'number',
        isRequired: false,
        sortOrder: 0,
      });
      await repo.save(field);

      field.update({ displayName: 'Updated Display' });
      await repo.save(field);

      const results = await repo.findBySchemaId('schema-1');
      expect(results[0].displayName).toBe('Updated Display');
    });
  });

  describe('delete', () => {
    it('should remove a field definition', async () => {
      const field = FieldDefinition.create({
        id: 'field-del',
        schemaId: 'schema-1',
        fieldName: 'delete_me',
        displayName: 'Delete Me',
        dataType: 'string',
        isRequired: false,
        sortOrder: 0,
      });
      await repo.save(field);
      await repo.delete('field-del');

      const results = await repo.findBySchemaId('schema-1');
      expect(results).toHaveLength(0);
    });
  });

  describe('nullable fields', () => {
    it('should handle null validationRules and extractionHint', async () => {
      const field = FieldDefinition.create({
        id: 'field-null',
        schemaId: 'schema-1',
        fieldName: 'bare_field',
        displayName: 'Bare',
        dataType: 'string',
        isRequired: false,
        sortOrder: 0,
      });
      await repo.save(field);

      const results = await repo.findBySchemaId('schema-1');
      expect(results[0].validationRules).toBeNull();
      expect(results[0].extractionHint).toBeNull();
    });
  });
});
