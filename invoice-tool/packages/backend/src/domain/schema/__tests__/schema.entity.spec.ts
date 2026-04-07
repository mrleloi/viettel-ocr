import { Schema } from '../schema.entity';
import { DomainError } from '../../shared/domain-error';

function createSchema(overrides?: Record<string, unknown>): Schema {
  return Schema.create({
    name: 'Digiworld VAT Invoice',
    nccName: 'Digiworld',
    nccTaxId: '0302861742',
    description: 'HĐ GTGT từ Digiworld',
    ...overrides,
  });
}

describe('Schema', () => {
  describe('create', () => {
    it('should create schema with valid props', () => {
      const schema = createSchema();
      expect(schema.id).toBeDefined();
      expect(schema.name).toBe('Digiworld VAT Invoice');
      expect(schema.nccName).toBe('Digiworld');
      expect(schema.status).toBe('draft');
      expect(schema.version).toBe(1);
      expect(schema.createdAt).toBeInstanceOf(Date);
    });

    it('should start with draft status', () => {
      const schema = createSchema();
      expect(schema.status).toBe('draft');
    });

    it('should create with null optional fields', () => {
      const schema = createSchema({ description: null, promptTemplate: null, behaviorConfig: null });
      expect(schema.description).toBeNull();
      expect(schema.promptTemplate).toBeNull();
      expect(schema.behaviorConfig).toBeNull();
    });

    it('should throw DomainError when name is empty', () => {
      expect(() => createSchema({ name: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when nccName is empty', () => {
      expect(() => createSchema({ nccName: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when nccTaxId is empty', () => {
      expect(() => createSchema({ nccTaxId: '' })).toThrow(DomainError);
    });
  });

  describe('reconstitute', () => {
    it('should recreate schema from stored props', () => {
      const schema = Schema.reconstitute({
        id: 'schema-1',
        name: 'Test Schema',
        description: null,
        nccName: 'Test NCC',
        nccTaxId: '1234567890',
        status: 'active',
        promptTemplate: null,
        behaviorConfig: null,
        version: 3,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-04-01'),
      });
      expect(schema.id).toBe('schema-1');
      expect(schema.version).toBe(3);
      expect(schema.status).toBe('active');
    });
  });

  describe('activate', () => {
    it('should transition from draft to active', () => {
      const schema = createSchema();
      schema.activate();
      expect(schema.status).toBe('active');
    });

    it('should transition from inactive to active', () => {
      const schema = Schema.reconstitute({
        id: 's1', name: 'Test', description: null, nccName: 'NCC',
        nccTaxId: '1234567890', status: 'inactive',
        promptTemplate: null, behaviorConfig: null,
        version: 1, createdAt: new Date(), updatedAt: new Date(),
      });
      schema.activate();
      expect(schema.status).toBe('active');
    });

    it('should be idempotent when already active', () => {
      const schema = createSchema();
      schema.activate();
      schema.activate();
      expect(schema.status).toBe('active');
    });
  });

  describe('deactivate', () => {
    it('should transition from active to inactive', () => {
      const schema = createSchema();
      schema.activate();
      schema.deactivate();
      expect(schema.status).toBe('inactive');
    });
  });

  describe('updatePromptTemplate', () => {
    it('should update prompt template and increment version', () => {
      const schema = createSchema();
      const initialVersion = schema.version;
      schema.updatePromptTemplate('New prompt template');
      expect(schema.promptTemplate).toBe('New prompt template');
      expect(schema.version).toBe(initialVersion + 1);
    });
  });

  describe('updateBehaviorConfig', () => {
    it('should update behavior config', () => {
      const schema = createSchema();
      const config = JSON.stringify({ on_high_confidence: 'export_csv' });
      schema.updateBehaviorConfig(config);
      expect(schema.behaviorConfig).toBe(config);
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const schema = createSchema({ id: 'schema-test' });
      const props = schema.toProps();
      expect(props.id).toBe('schema-test');
      expect(props.name).toBe('Digiworld VAT Invoice');
      expect(props.status).toBe('draft');
    });
  });
});
