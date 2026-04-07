import { FingerprintRule } from '../fingerprint-rule.entity';
import { DomainError } from '../../shared/domain-error';

function createRule(overrides?: Record<string, unknown>): FingerprintRule {
  return FingerprintRule.create({
    schemaId: 'schema-1',
    ruleType: 'mst_exact',
    pattern: '0302861742',
    priority: 1,
    ...overrides,
  });
}

describe('FingerprintRule', () => {
  describe('create', () => {
    it('should create rule with valid props', () => {
      const rule = createRule();
      expect(rule.id).toBeDefined();
      expect(rule.schemaId).toBe('schema-1');
      expect(rule.ruleType).toBe('mst_exact');
      expect(rule.pattern).toBe('0302861742');
      expect(rule.priority).toBe(1);
      expect(rule.isActive).toBe(true);
    });

    it('should accept all valid rule types', () => {
      expect(createRule({ ruleType: 'mst_exact' }).ruleType).toBe('mst_exact');
      expect(createRule({ ruleType: 'keyword' }).ruleType).toBe('keyword');
      expect(createRule({ ruleType: 'symbol_regex' }).ruleType).toBe('symbol_regex');
      expect(createRule({ ruleType: 'custom' }).ruleType).toBe('custom');
    });

    it('should throw DomainError when pattern is empty', () => {
      expect(() => createRule({ pattern: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when schemaId is empty', () => {
      expect(() => createRule({ schemaId: '' })).toThrow(DomainError);
    });

    it('should throw DomainError for invalid ruleType', () => {
      expect(() => createRule({ ruleType: 'invalid' })).toThrow(DomainError);
    });

    it('should throw DomainError for negative priority', () => {
      expect(() => createRule({ priority: -1 })).toThrow(DomainError);
    });
  });

  describe('deactivate', () => {
    it('should deactivate an active rule', () => {
      const rule = createRule();
      rule.deactivate();
      expect(rule.isActive).toBe(false);
    });
  });

  describe('activate', () => {
    it('should activate an inactive rule', () => {
      const rule = createRule();
      rule.deactivate();
      rule.activate();
      expect(rule.isActive).toBe(true);
    });
  });

  describe('reconstitute', () => {
    it('should recreate from stored props', () => {
      const rule = FingerprintRule.reconstitute({
        id: 'rule-1',
        schemaId: 'schema-1',
        ruleType: 'keyword',
        pattern: 'DIGIWORLD',
        priority: 5,
        isActive: false,
        createdAt: new Date('2026-01-01'),
      });
      expect(rule.id).toBe('rule-1');
      expect(rule.isActive).toBe(false);
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const rule = createRule({ id: 'rule-test' });
      const props = rule.toProps();
      expect(props.id).toBe('rule-test');
      expect(props.ruleType).toBe('mst_exact');
    });
  });
});
