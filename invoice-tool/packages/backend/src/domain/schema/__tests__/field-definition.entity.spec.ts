import { FieldDefinition } from '../field-definition.entity';
import { DomainError } from '../../shared/domain-error';

function createField(overrides?: Record<string, unknown>): FieldDefinition {
  return FieldDefinition.create({
    schemaId: 'schema-1',
    fieldName: 'invoice_number',
    displayName: 'Số hóa đơn',
    dataType: 'string',
    isRequired: true,
    sortOrder: 1,
    ...overrides,
  });
}

describe('FieldDefinition', () => {
  describe('create', () => {
    it('should create field definition with valid props', () => {
      const field = createField();
      expect(field.id).toBeDefined();
      expect(field.fieldName).toBe('invoice_number');
      expect(field.displayName).toBe('Số hóa đơn');
      expect(field.dataType).toBe('string');
      expect(field.isRequired).toBe(true);
    });

    it('should accept all valid data types', () => {
      expect(createField({ dataType: 'string' }).dataType).toBe('string');
      expect(createField({ dataType: 'integer' }).dataType).toBe('integer');
      expect(createField({ dataType: 'number' }).dataType).toBe('number');
      expect(createField({ dataType: 'date' }).dataType).toBe('date');
      expect(createField({ dataType: 'boolean' }).dataType).toBe('boolean');
    });

    it('should create with null optional fields', () => {
      const field = createField({ validationRules: null, extractionHint: null });
      expect(field.validationRules).toBeNull();
      expect(field.extractionHint).toBeNull();
    });

    it('should throw DomainError when fieldName is empty', () => {
      expect(() => createField({ fieldName: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when displayName is empty', () => {
      expect(() => createField({ displayName: '' })).toThrow(DomainError);
    });

    it('should throw DomainError for invalid dataType', () => {
      expect(() => createField({ dataType: 'invalid' })).toThrow(DomainError);
    });

    it('should throw DomainError for negative sortOrder', () => {
      expect(() => createField({ sortOrder: -1 })).toThrow(DomainError);
    });
  });

  describe('reconstitute', () => {
    it('should recreate from stored props', () => {
      const field = FieldDefinition.reconstitute({
        id: 'field-1',
        schemaId: 'schema-1',
        fieldName: 'total',
        displayName: 'Tổng tiền',
        dataType: 'integer',
        isRequired: true,
        validationRules: '{"min": 0}',
        extractionHint: 'Tổng cộng tiền thanh toán',
        outputKey: 'total',
        sortOrder: 10,
      });
      expect(field.id).toBe('field-1');
      expect(field.dataType).toBe('integer');
    });
  });

  describe('update', () => {
    it('should update mutable fields', () => {
      const field = createField();
      field.update({
        displayName: 'Invoice Number',
        isRequired: false,
        extractionHint: 'Hint text',
      });
      expect(field.displayName).toBe('Invoice Number');
      expect(field.isRequired).toBe(false);
      expect(field.extractionHint).toBe('Hint text');
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const field = createField({ id: 'field-test' });
      const props = field.toProps();
      expect(props.id).toBe('field-test');
      expect(props.fieldName).toBe('invoice_number');
    });
  });
});
