import { FingerprintService } from '../fingerprint.service';
import type { FingerprintInput, FingerprintRuleData } from '../fingerprint.service';

describe('FingerprintService', () => {
  let service: FingerprintService;

  beforeEach(() => {
    service = new FingerprintService();
  });

  // --- Factory helpers ---

  function makeRule(overrides: Partial<FingerprintRuleData> = {}): FingerprintRuleData {
    return {
      id: 'rule-1',
      schemaId: 'schema-1',
      ruleType: 'mst_exact',
      ruleField: 'seller_tax_id',
      ruleValue: '0100109106',
      priority: 1,
      ...overrides,
    };
  }

  function makeInput(overrides: Partial<FingerprintInput> = {}): FingerprintInput {
    return {
      ocrText: 'Hóa đơn GTGT Mã số thuế: 0100109106 Số: AA/23E 0001234',
      sellerTaxId: '0100109106',
      invoiceSymbol: 'AA/23E',
      ...overrides,
    };
  }

  // --- Happy Path Tests ---

  it('should match MST exact and return score 1.0', () => {
    const rules = [makeRule({ ruleType: 'mst_exact', ruleValue: '0100109106' })];
    const input = makeInput({ sellerTaxId: '0100109106' });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.schemaId).toBe('schema-1');
    expect(result.score).toBe(1.0);
    expect(result.matchedRules).toContain('rule-1');
    expect(result.method).toBe('mst_exact');
  });

  it('should match keyword_contains and return score 0.7', () => {
    const rules = [
      makeRule({
        id: 'rule-kw',
        ruleType: 'keyword_contains',
        ruleField: 'full_text',
        ruleValue: 'CÔNG TY TNHH ABC',
      }),
    ];
    const input = makeInput({
      ocrText: 'HÓA ĐƠN GTGT\nCÔNG TY TNHH ABC\nĐịa chỉ: 123 Nguyễn Huệ',
      sellerTaxId: undefined,
    });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.score).toBe(0.7);
    expect(result.method).toBe('keyword');
  });

  it('should match symbol_regex and return score 0.8', () => {
    const rules = [
      makeRule({
        id: 'rule-sym',
        ruleType: 'symbol_regex',
        ruleField: 'invoice_symbol',
        ruleValue: '^AA/\\d{2}E$',
      }),
    ];
    const input = makeInput({ invoiceSymbol: 'AA/23E' });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.score).toBe(0.8);
    expect(result.method).toBe('symbol_regex');
  });

  // --- Edge Cases ---

  it('should select highest scoring schema when multiple schemas match', () => {
    const rules = [
      makeRule({
        id: 'rule-kw-low',
        schemaId: 'schema-A',
        ruleType: 'keyword_contains',
        ruleField: 'full_text',
        ruleValue: 'hóa đơn',
        priority: 1,
      }),
      makeRule({
        id: 'rule-mst-high',
        schemaId: 'schema-B',
        ruleType: 'mst_exact',
        ruleField: 'seller_tax_id',
        ruleValue: '0100109106',
        priority: 1,
      }),
    ];
    const input = makeInput({ sellerTaxId: '0100109106' });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.schemaId).toBe('schema-B');
    expect(result.score).toBe(1.0);
  });

  it('should use highest priority rule when same schema has multiple matching rules', () => {
    const rules = [
      makeRule({
        id: 'rule-low-pri',
        schemaId: 'schema-1',
        ruleType: 'keyword_contains',
        ruleField: 'full_text',
        ruleValue: 'hóa đơn',
        priority: 10,
      }),
      makeRule({
        id: 'rule-high-pri',
        schemaId: 'schema-1',
        ruleType: 'mst_exact',
        ruleField: 'seller_tax_id',
        ruleValue: '0100109106',
        priority: 1,
      }),
    ];
    const input = makeInput({ sellerTaxId: '0100109106' });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.schemaId).toBe('schema-1');
    expect(result.score).toBe(1.0);
    expect(result.matchedRules).toContain('rule-high-pri');
    expect(result.matchedRules).toContain('rule-low-pri');
  });

  it('should handle tax ID with whitespace and dashes', () => {
    const rules = [makeRule({ ruleType: 'mst_exact', ruleValue: '0100109106' })];
    const input = makeInput({ sellerTaxId: ' 0100109106 ' });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.score).toBe(1.0);
  });

  it('should handle mst_contains by searching in OCR text', () => {
    const rules = [
      makeRule({
        id: 'rule-mst-contains',
        ruleType: 'mst_contains',
        ruleField: 'full_text',
        ruleValue: '0100109106',
      }),
    ];
    const input = makeInput({
      ocrText: 'MST người bán: 0100109106 Tên: ABC',
      sellerTaxId: undefined,
    });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(true);
    expect(result.score).toBe(0.9);
  });

  // --- Error Cases ---

  it('should return no match when no rules are provided', () => {
    const input = makeInput();

    const result = service.classify(input, []);

    expect(result.matched).toBe(false);
    expect(result.schemaId).toBeNull();
    expect(result.score).toBe(0);
    expect(result.matchedRules).toEqual([]);
    expect(result.method).toBeNull();
  });

  it('should handle invalid regex patterns gracefully (no throw)', () => {
    const rules = [
      makeRule({
        id: 'rule-bad-regex',
        ruleType: 'custom_regex',
        ruleField: 'full_text',
        ruleValue: '[invalid(regex',
      }),
    ];
    const input = makeInput();

    expect(() => service.classify(input, rules)).not.toThrow();

    const result = service.classify(input, rules);
    expect(result.matched).toBe(false);
  });

  it('should return no match for empty OCR text', () => {
    const rules = [
      makeRule({
        ruleType: 'keyword_contains',
        ruleField: 'full_text',
        ruleValue: 'some text',
      }),
    ];
    const input = makeInput({ ocrText: '', sellerTaxId: undefined, invoiceSymbol: undefined });

    const result = service.classify(input, rules);

    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
  });
});
