import { ValidatorService } from '../validator.service';
import type { ExtractedInvoiceData } from '../validator.service';

describe('ValidatorService', () => {
  let service: ValidatorService;

  beforeEach(() => {
    service = new ValidatorService();
  });

  // --- Factory helper ---

  function makeValidData(overrides: Partial<ExtractedInvoiceData> = {}): ExtractedInvoiceData {
    return {
      invoiceNumber: '0001234',
      invoiceSymbol: 'AA/23E',
      invoiceDate: new Date().toISOString().split('T')[0], // today
      sellerTaxId: '0100109106',
      buyerTaxId: '0312345678',
      subtotal: 1000000,
      vatRate: 10,
      vatAmount: 100000,
      total: 1100000,
      lineItems: [
        {
          name: 'Sản phẩm A',
          quantity: 10,
          unitPrice: 100000,
          amount: 1000000,
        },
      ],
      ...overrides,
    };
  }

  // --- 1. Happy: All fields valid ---
  it('should return valid when all fields pass validation', () => {
    const data = makeValidData();
    const result = service.validate(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.passRate).toBeGreaterThan(0.9);
  });

  // --- 2. Happy: Valid with line items matching subtotal ---
  it('should validate line items that sum to subtotal', () => {
    const data = makeValidData({
      subtotal: 2000000,
      vatAmount: 200000,
      total: 2200000,
      lineItems: [
        { name: 'Item A', quantity: 10, unitPrice: 100000, amount: 1000000 },
        { name: 'Item B', quantity: 5, unitPrice: 200000, amount: 1000000 },
      ],
    });
    const result = service.validate(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // --- 2b. Bug repro: subtotal mismatches sum of line items → error ---
  // Real-world OCR bug: Gemini grabbed the VAT-amount column as subtotal.
  // Header said subtotal=-119,398,400 but line_items summed to -1,492,480,000.
  // This MUST surface as an error, not a silent warning.
  it('should error when sum of line items does not match subtotal', () => {
    const data = makeValidData({
      subtotal: -119398400, // wrong: actually the VAT amount
      vatRate: 8,
      vatAmount: -119398400, // same value duplicated — smoking gun
      total: -1611878400,
      lineItems: [
        { name: 'Item A', quantity: 1, unitPrice: -1500000, amount: -1500000 },
        { name: 'Item B', quantity: 1, unitPrice: -172500000, amount: -172500000 },
        { name: 'Item C', quantity: 1, unitPrice: -490500000, amount: -490500000 },
        { name: 'Item D', quantity: 1, unitPrice: -826480000, amount: -826480000 },
        { name: 'Item E', quantity: 1, unitPrice: -1500000, amount: -1500000 },
      ],
    });
    const result = service.validate(data);

    const mismatchErrors = result.errors.filter(
      e => e.rule === 'line_items_sum_matches_subtotal',
    );
    expect(mismatchErrors).toHaveLength(1);
    expect(mismatchErrors[0].severity).toBe('error');
    expect(result.valid).toBe(false);
  });

  // --- 3. Edge: VAT amount off by 1 VND → tolerance ---
  it('should pass when VAT amount is off by 1 VND (tolerance)', () => {
    const data = makeValidData({
      subtotal: 999999,
      vatRate: 10,
      vatAmount: 100000, // expected: 99999.9 → 99999 or 100000, 1 VND tolerance
      total: 1099999,
    });
    const result = service.validate(data);

    // The vatAmount check should pass within ±1 tolerance
    const vatErrors = result.errors.filter(e => e.field === 'vatAmount');
    expect(vatErrors).toHaveLength(0);
  });

  // --- 4. Edge: Total off by exactly 1 VND → passes ---
  it('should pass when total is off by exactly 1 VND', () => {
    const data = makeValidData({
      subtotal: 1000000,
      vatAmount: 100000,
      total: 1100001, // off by 1
    });
    const result = service.validate(data);

    const totalErrors = result.errors.filter(e => e.field === 'total');
    expect(totalErrors).toHaveLength(0);
  });

  // --- 5. Edge: Total off by 2 VND → fails ---
  it('should fail when total is off by 2 VND', () => {
    const data = makeValidData({
      subtotal: 1000000,
      vatAmount: 100000,
      total: 1100002, // off by 2
    });
    const result = service.validate(data);

    const totalErrors = result.errors.filter(e => e.field === 'total');
    expect(totalErrors.length).toBeGreaterThan(0);
    expect(totalErrors[0].rule).toBe('total_equals_subtotal_plus_vat');
  });

  // --- 6. Edge: null optional fields → warnings, not errors ---
  it('should produce warnings for null VAT rate (not errors)', () => {
    const data = makeValidData({
      vatRate: null,
      vatAmount: null,
      total: 1000000, // total = subtotal when no VAT
    });
    const result = service.validate(data);

    const vatWarnings = result.warnings.filter(e => e.field === 'vatRate');
    expect(vatWarnings.length).toBeGreaterThan(0);
    // Should not produce errors for null VAT (only warnings)
    const vatErrors = result.errors.filter(e => e.field === 'vatRate' && e.rule === 'vat_rate_valid');
    expect(vatErrors).toHaveLength(0);
  });

  // --- 7. Edge: Invoice date exactly 180 days ago → passes ---
  it('should pass when invoice date is exactly 180 days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 180);
    const dateStr = date.toISOString().split('T')[0];

    const data = makeValidData({ invoiceDate: dateStr });
    const result = service.validate(data);

    const dateErrors = result.errors.filter(e => e.field === 'invoiceDate' && e.rule === 'invoice_date_not_too_old');
    expect(dateErrors).toHaveLength(0);
  });

  // --- 8. Edge: Invoice date 181 days ago → warning ---
  it('should warn when invoice date is 181 days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 181);
    const dateStr = date.toISOString().split('T')[0];

    const data = makeValidData({ invoiceDate: dateStr });
    const result = service.validate(data);

    const dateWarnings = result.warnings.filter(e => e.field === 'invoiceDate' && e.rule === 'invoice_date_not_too_old');
    expect(dateWarnings.length).toBeGreaterThan(0);
  });

  // --- 9. Error: Missing invoice_number ---
  it('should return error when invoice_number is missing', () => {
    const data = makeValidData({ invoiceNumber: null });
    const result = service.validate(data);

    expect(result.valid).toBe(false);
    const numberErrors = result.errors.filter(e => e.field === 'invoiceNumber');
    expect(numberErrors.length).toBeGreaterThan(0);
    expect(numberErrors[0].severity).toBe('error');
  });

  // --- 10. Error: Invalid tax ID format ---
  it('should return error for invalid seller tax ID format', () => {
    const data = makeValidData({ sellerTaxId: '123' }); // too short
    const result = service.validate(data);

    expect(result.valid).toBe(false);
    const taxErrors = result.errors.filter(e => e.field === 'sellerTaxId');
    expect(taxErrors.length).toBeGreaterThan(0);
  });

  // --- 11. Error: Future invoice date ---
  it('should return error for future invoice date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const dateStr = futureDate.toISOString().split('T')[0];

    const data = makeValidData({ invoiceDate: dateStr });
    const result = service.validate(data);

    expect(result.valid).toBe(false);
    const dateErrors = result.errors.filter(e => e.field === 'invoiceDate' && e.rule === 'invoice_date_not_future');
    expect(dateErrors.length).toBeGreaterThan(0);
  });

  // --- 12. Error: Invalid VAT rate ---
  it('should return error for invalid VAT rate', () => {
    const data = makeValidData({ vatRate: 15 }); // not in {0, 5, 8, 10}
    const result = service.validate(data);

    expect(result.valid).toBe(false);
    const vatErrors = result.errors.filter(e => e.field === 'vatRate' && e.rule === 'vat_rate_valid');
    expect(vatErrors.length).toBeGreaterThan(0);
  });

  // --- 13. Error: No line items ---
  it('should return error when no line items provided', () => {
    const data = makeValidData({ lineItems: [] });
    const result = service.validate(data);

    expect(result.valid).toBe(false);
    const itemErrors = result.errors.filter(e => e.field === 'lineItems');
    expect(itemErrors.length).toBeGreaterThan(0);
  });
});
