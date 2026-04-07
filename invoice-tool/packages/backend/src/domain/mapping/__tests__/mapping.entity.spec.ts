import { Mapping } from '../mapping.entity';
import { DomainError } from '../../shared/domain-error';

function createMapping(overrides?: Record<string, unknown>): Mapping {
  return Mapping.create({
    schemaId: 'schema-1',
    partnerProductName: 'Xiaomi Sound Outdoor 30W Vàng (QBH4370GL)',
    source: 'manual',
    ...overrides,
  });
}

describe('Mapping', () => {
  describe('create', () => {
    it('should create mapping with valid props', () => {
      const mapping = createMapping();
      expect(mapping.id).toBeDefined();
      expect(mapping.schemaId).toBe('schema-1');
      expect(mapping.partnerProductName).toBe('Xiaomi Sound Outdoor 30W Vàng (QBH4370GL)');
      expect(mapping.status).toBe('active');
      expect(mapping.source).toBe('manual');
      expect(mapping.usageCount).toBe(0);
    });

    it('should create with null optional fields', () => {
      const mapping = createMapping({
        partnerProductCode: null,
        viettelProductId: null,
        viettelProductCode: null,
        viettelProductName: null,
        confidence: null,
      });
      expect(mapping.partnerProductCode).toBeNull();
      expect(mapping.viettelProductId).toBeNull();
    });

    it('should create auto-learned mapping with confidence', () => {
      const mapping = createMapping({
        source: 'auto_learned',
        confidence: 0.85,
        viettelProductId: 'prod-1',
        viettelProductCode: 'LOA-XM-OUTDOOR-30W',
        viettelProductName: 'Loa Bluetooth Xiaomi Sound Outdoor 30W',
      });
      expect(mapping.source).toBe('auto_learned');
      expect(mapping.confidence).toBe(0.85);
      expect(mapping.status).toBe('pending_review');
    });

    it('should throw DomainError when schemaId is empty', () => {
      expect(() => createMapping({ schemaId: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when partnerProductName is empty', () => {
      expect(() => createMapping({ partnerProductName: '' })).toThrow(DomainError);
    });

    it('should throw DomainError for invalid source', () => {
      expect(() => createMapping({ source: 'invalid' })).toThrow(DomainError);
    });

    it('should throw DomainError for confidence out of range', () => {
      expect(() => createMapping({ confidence: 1.5 })).toThrow(DomainError);
      expect(() => createMapping({ confidence: -0.1 })).toThrow(DomainError);
    });
  });

  describe('linkToViettelProduct', () => {
    it('should link mapping to a Viettel product', () => {
      const mapping = createMapping();
      mapping.linkToViettelProduct('prod-1', 'LOA-XM-30W', 'Loa Xiaomi 30W');
      expect(mapping.viettelProductId).toBe('prod-1');
      expect(mapping.viettelProductCode).toBe('LOA-XM-30W');
      expect(mapping.viettelProductName).toBe('Loa Xiaomi 30W');
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count and update lastUsedAt', () => {
      const mapping = createMapping();
      mapping.incrementUsage();
      expect(mapping.usageCount).toBe(1);
      expect(mapping.lastUsedAt).toBeInstanceOf(Date);
      mapping.incrementUsage();
      expect(mapping.usageCount).toBe(2);
    });
  });

  describe('deactivate', () => {
    it('should deactivate mapping', () => {
      const mapping = createMapping();
      mapping.deactivate();
      expect(mapping.status).toBe('inactive');
    });
  });

  describe('approve', () => {
    it('should approve pending_review mapping', () => {
      const mapping = createMapping({
        source: 'auto_learned',
        confidence: 0.85,
      });
      mapping.approve();
      expect(mapping.status).toBe('active');
    });

    it('should throw when already active', () => {
      const mapping = createMapping();
      expect(() => mapping.approve()).toThrow(DomainError);
    });
  });

  describe('reconstitute', () => {
    it('should recreate from stored props', () => {
      const mapping = Mapping.reconstitute({
        id: 'map-1',
        schemaId: 'schema-1',
        partnerProductName: 'Partner Product',
        partnerProductCode: 'PP-001',
        viettelProductId: 'prod-1',
        viettelProductCode: 'VP-001',
        viettelProductName: 'Viettel Product',
        status: 'active',
        source: 'manual',
        confidence: null,
        usageCount: 42,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(mapping.id).toBe('map-1');
      expect(mapping.usageCount).toBe(42);
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const mapping = createMapping({ id: 'map-test' });
      const props = mapping.toProps();
      expect(props.id).toBe('map-test');
      expect(props.source).toBe('manual');
    });
  });
});
