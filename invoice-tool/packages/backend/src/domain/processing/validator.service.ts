/**
 * Validation error detail.
 */
export interface ValidationError {
  /** Field that failed validation */
  readonly field: string;
  /** Validation rule that was violated */
  readonly rule: string;
  /** Human-readable error message */
  readonly message: string;
  /** Severity: 'error' blocks approval, 'warning' is informational */
  readonly severity: 'error' | 'warning';
  /** Expected value (if applicable) */
  readonly expected?: string;
  /** Actual value (if applicable) */
  readonly actual?: string;
}

/**
 * Result of invoice data validation.
 */
export interface ValidationResult {
  /** Whether the data passed all error-level rules */
  readonly valid: boolean;
  /** Error-level validation failures */
  readonly errors: ValidationError[];
  /** Warning-level validation issues */
  readonly warnings: ValidationError[];
  /** Ratio of rules passed vs total rules checked (0-1) */
  readonly passRate: number;
}

/**
 * Extracted invoice data — the input to validate.
 */
export interface ExtractedInvoiceData {
  readonly invoiceNumber: string | null;
  readonly invoiceSymbol: string | null;
  readonly invoiceDate: string | null;
  readonly sellerTaxId: string | null;
  readonly buyerTaxId: string | null;
  readonly subtotal: number | null;
  readonly vatRate: number | null;
  readonly vatAmount: number | null;
  readonly total: number | null;
  readonly lineItems: ReadonlyArray<{
    readonly name: string | null;
    readonly quantity: number | null;
    readonly unitPrice: number | null;
    readonly amount: number | null;
  }>;
}

/** Valid Vietnamese VAT rates */
const VALID_VAT_RATES = [0, 5, 8, 10];

/** Tax ID pattern: 10 digits, optionally followed by dash and 3 digits */
const TAX_ID_PATTERN = /^\d{10}(-\d{3})?$/;

/** VND tolerance for arithmetic checks */
const VND_TOLERANCE = 1;

/** Maximum age for invoice dates (days) */
const MAX_INVOICE_AGE_DAYS = 180;

/**
 * ValidatorService — stateless domain service for invoice data validation.
 *
 * Checks extracted invoice data against field-level and cross-field business rules.
 * Returns a structured result with errors (blocking) and warnings (informational).
 */
export class ValidatorService {
  /**
   * Validate extracted invoice data against business rules.
   * @param data Extracted invoice data to validate
   * @returns Validation result with errors, warnings, and pass rate
   */
  validate(data: ExtractedInvoiceData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let totalRules = 0;
    let passedRules = 0;

    // --- Required field checks ---

    totalRules++;
    if (!data.invoiceNumber || data.invoiceNumber.trim() === '') {
      errors.push({
        field: 'invoiceNumber',
        rule: 'invoice_number_required',
        message: 'Invoice number is required',
        severity: 'error',
      });
    } else {
      passedRules++;
    }

    totalRules++;
    if (!data.invoiceSymbol || data.invoiceSymbol.trim() === '') {
      errors.push({
        field: 'invoiceSymbol',
        rule: 'invoice_symbol_required',
        message: 'Invoice symbol is required',
        severity: 'error',
      });
    } else {
      passedRules++;
    }

    // --- Date validation ---

    totalRules++;
    if (data.invoiceDate) {
      const parsed = this.parseDate(data.invoiceDate);
      if (!parsed) {
        errors.push({
          field: 'invoiceDate',
          rule: 'invoice_date_valid',
          message: 'Invoice date is not a valid date',
          severity: 'error',
          actual: data.invoiceDate,
        });
      } else {
        passedRules++;

        // Check future date
        totalRules++;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (parsed > today) {
          errors.push({
            field: 'invoiceDate',
            rule: 'invoice_date_not_future',
            message: 'Invoice date cannot be in the future',
            severity: 'error',
            actual: data.invoiceDate,
          });
        } else {
          passedRules++;
        }

        // Check too old
        totalRules++;
        const maxAge = new Date();
        maxAge.setDate(maxAge.getDate() - MAX_INVOICE_AGE_DAYS);
        maxAge.setHours(0, 0, 0, 0);
        if (parsed < maxAge) {
          warnings.push({
            field: 'invoiceDate',
            rule: 'invoice_date_not_too_old',
            message: `Invoice date is older than ${MAX_INVOICE_AGE_DAYS} days`,
            severity: 'warning',
            actual: data.invoiceDate,
          });
        } else {
          passedRules++;
        }
      }
    } else {
      errors.push({
        field: 'invoiceDate',
        rule: 'invoice_date_valid',
        message: 'Invoice date is required',
        severity: 'error',
      });
    }

    // --- Tax ID validation ---

    totalRules++;
    if (data.sellerTaxId) {
      if (!TAX_ID_PATTERN.test(data.sellerTaxId)) {
        errors.push({
          field: 'sellerTaxId',
          rule: 'seller_tax_id_format',
          message: 'Seller tax ID must be 10 digits, optionally followed by -XXX',
          severity: 'error',
          expected: 'XXXXXXXXXX or XXXXXXXXXX-XXX',
          actual: data.sellerTaxId,
        });
      } else {
        passedRules++;
      }
    } else {
      errors.push({
        field: 'sellerTaxId',
        rule: 'seller_tax_id_format',
        message: 'Seller tax ID is required',
        severity: 'error',
      });
    }

    totalRules++;
    if (data.buyerTaxId) {
      if (!TAX_ID_PATTERN.test(data.buyerTaxId)) {
        errors.push({
          field: 'buyerTaxId',
          rule: 'buyer_tax_id_format',
          message: 'Buyer tax ID must be 10 digits, optionally followed by -XXX',
          severity: 'error',
          expected: 'XXXXXXXXXX or XXXXXXXXXX-XXX',
          actual: data.buyerTaxId,
        });
      } else {
        passedRules++;
      }
    } else {
      // Buyer tax ID is optional — warning only
      warnings.push({
        field: 'buyerTaxId',
        rule: 'buyer_tax_id_format',
        message: 'Buyer tax ID is missing',
        severity: 'warning',
      });
    }

    // --- VAT rate validation ---

    totalRules++;
    if (data.vatRate !== null && data.vatRate !== undefined) {
      if (!VALID_VAT_RATES.includes(data.vatRate)) {
        errors.push({
          field: 'vatRate',
          rule: 'vat_rate_valid',
          message: `VAT rate must be one of: ${VALID_VAT_RATES.join(', ')}`,
          severity: 'error',
          expected: VALID_VAT_RATES.join(', '),
          actual: String(data.vatRate),
        });
      } else {
        passedRules++;
      }
    } else {
      warnings.push({
        field: 'vatRate',
        rule: 'vat_rate_missing',
        message: 'VAT rate is not specified',
        severity: 'warning',
      });
    }

    // --- Cross-field arithmetic checks ---

    // VAT amount = subtotal × vatRate / 100
    if (data.subtotal !== null && data.vatRate !== null && data.vatAmount !== null) {
      totalRules++;
      const expectedVat = data.subtotal * data.vatRate / 100;
      if (Math.abs(data.vatAmount - expectedVat) > VND_TOLERANCE) {
        errors.push({
          field: 'vatAmount',
          rule: 'vat_amount_calculation',
          message: 'VAT amount does not match subtotal × VAT rate',
          severity: 'error',
          expected: String(Math.round(expectedVat)),
          actual: String(data.vatAmount),
        });
      } else {
        passedRules++;
      }
    }

    // Total = subtotal + vatAmount
    if (data.subtotal !== null && data.vatAmount !== null && data.total !== null) {
      totalRules++;
      const expectedTotal = data.subtotal + data.vatAmount;
      if (Math.abs(data.total - expectedTotal) > VND_TOLERANCE) {
        errors.push({
          field: 'total',
          rule: 'total_equals_subtotal_plus_vat',
          message: 'Total does not equal subtotal + VAT amount',
          severity: 'error',
          expected: String(expectedTotal),
          actual: String(data.total),
        });
      } else {
        passedRules++;
      }
    }

    // --- Line items validation ---

    totalRules++;
    if (!data.lineItems || data.lineItems.length === 0) {
      errors.push({
        field: 'lineItems',
        rule: 'line_items_required',
        message: 'At least one line item is required',
        severity: 'error',
      });
    } else {
      passedRules++;

      // Validate individual line item amounts
      for (let i = 0; i < data.lineItems.length; i++) {
        const item = data.lineItems[i];
        if (item.quantity !== null && item.unitPrice !== null && item.amount !== null) {
          totalRules++;
          const expectedAmount = item.quantity * item.unitPrice;
          if (Math.abs(item.amount - expectedAmount) > VND_TOLERANCE) {
            errors.push({
              field: `lineItems[${i}].amount`,
              rule: 'line_item_amount_calculation',
              message: `Line item ${i + 1} amount does not equal quantity × unit price`,
              severity: 'error',
              expected: String(expectedAmount),
              actual: String(item.amount),
            });
          } else {
            passedRules++;
          }
        }
      }

      // Line items sum ≈ subtotal
      if (data.subtotal !== null) {
        totalRules++;
        const lineItemsSum = data.lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
        if (Math.abs(lineItemsSum - data.subtotal) > VND_TOLERANCE) {
          warnings.push({
            field: 'lineItems',
            rule: 'line_items_sum_matches_subtotal',
            message: 'Sum of line item amounts does not match subtotal',
            severity: 'warning',
            expected: String(data.subtotal),
            actual: String(lineItemsSum),
          });
        } else {
          passedRules++;
        }
      }
    }

    const passRate = totalRules > 0 ? passedRules / totalRules : 0;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      passRate,
    };
  }

  /**
   * Parse a date string (YYYY-MM-DD or ISO format).
   * @param dateStr Date string to parse
   * @returns Parsed Date or null if invalid
   */
  private parseDate(dateStr: string): Date | null {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }
}
