/**
 * Schema data for prompt building.
 */
export interface SchemaData {
  /** Schema ID */
  readonly id: string;
  /** Schema display name */
  readonly name: string;
  /** Schema description */
  readonly description: string | null;
  /** NCC (supplier) company name */
  readonly nccName: string;
  /** NCC tax ID (MST) */
  readonly nccTaxId: string;
  /** Custom prompt template, or null to use default */
  readonly promptTemplate: string | null;
}

/**
 * Field definition data for prompt building.
 */
export interface FieldData {
  /** Technical field name (e.g., "invoice_number") */
  readonly fieldName: string;
  /** Vietnamese display name (e.g., "Số hóa đơn") */
  readonly displayName: string;
  /** Expected data type */
  readonly dataType: 'string' | 'integer' | 'number' | 'date' | 'boolean';
  /** Whether this field is required */
  readonly isRequired: boolean;
  /** Extraction hint for the AI model */
  readonly extractionHint: string | null;
  /** Canonical output key for field-level mapping (e.g., "invoiceNumber") */
  readonly outputKey: string | null;
}

/**
 * Result of prompt building — system prompt + extraction prompt.
 */
export interface BuiltPrompt {
  /** System-level instruction prompt */
  readonly systemPrompt: string;
  /** Extraction/classification prompt with field details */
  readonly extractionPrompt: string;
}

/** Default system prompt for Vietnamese invoice extraction */
const DEFAULT_SYSTEM_PROMPT =
  'You are a Vietnamese invoice data extraction specialist. ' +
  'You extract structured data from Vietnamese PDF invoices (hóa đơn). ' +
  'You always return valid JSON. You never add commentary outside JSON.';

/**
 * PromptBuilder — stateless domain service for constructing Gemini API prompts.
 *
 * Builds prompts from schema templates and field definitions.
 * Supports two modes:
 * - Known schema: extraction-only prompt with specific field list
 * - Unknown schema: classification + extraction prompt with schema options
 */
export class PromptBuilder {
  /**
   * Build prompt for a known schema (extraction only).
   * @param schema Schema data with optional custom template
   * @param fields Field definitions for the schema
   * @returns BuiltPrompt with system and extraction prompts
   */
  buildKnownSchemaPrompt(schema: SchemaData, fields: FieldData[]): BuiltPrompt {
    const systemPrompt = DEFAULT_SYSTEM_PROMPT;
    const extractionPrompt = this.buildExtractionPrompt(schema, fields);

    return { systemPrompt, extractionPrompt };
  }

  /**
   * Build prompt for unknown schema (classification + extraction).
   * @param schemas List of available schemas for classification
   * @returns BuiltPrompt with system and extraction prompts
   */
  buildUnknownSchemaPrompt(schemas: SchemaData[]): BuiltPrompt {
    const systemPrompt = DEFAULT_SYSTEM_PROMPT;
    const extractionPrompt = this.buildClassificationPrompt(schemas);

    return { systemPrompt, extractionPrompt };
  }

  /**
   * Build the extraction prompt for a known schema.
   * @param schema Schema data
   * @param fields Field definitions
   * @returns Extraction prompt string
   */
  private buildExtractionPrompt(schema: SchemaData, fields: FieldData[]): string {
    const parts: string[] = [];

    // Custom template or default instruction
    if (schema.promptTemplate) {
      parts.push(schema.promptTemplate);
      parts.push('');
    }

    parts.push('Extract invoice data from this Vietnamese PDF. Return ONLY valid JSON.');
    parts.push(`Supplier: ${schema.nccName} (MST: ${schema.nccTaxId})`);
    parts.push('');

    // Field list
    if (fields.length > 0) {
      parts.push('Fields to extract:');
      for (const field of fields) {
        const reqMarker = field.isRequired ? ' [required]' : ' [optional]';
        const outputKeyInfo = field.outputKey ? ` → output as "${field.outputKey}"` : '';
        let line = `- ${field.fieldName} (${field.dataType}): ${field.displayName}${reqMarker}${outputKeyInfo}`;
        if (field.extractionHint) {
          line += ` — Hint: ${field.extractionHint}`;
        }
        parts.push(line);
      }
      parts.push('');
    }

    // Output format instructions
    parts.push('Output format:');
    parts.push('- Return ONLY valid JSON, no markdown or commentary');
    parts.push('- For each field, include a confidence score (0.0-1.0)');
    parts.push('- All monetary values as integers (VND). Negative values are allowed (hóa đơn điều chỉnh giảm / credit note).');
    parts.push('- Dates as YYYY-MM-DD');
    parts.push('- vat_rate is integer percent (10 means 10%, NOT 0.1)');
    parts.push('- If a field is not found, set value to null with confidence 0');
    parts.push('');
    parts.push('Header totals — column disambiguation (CRITICAL):');
    parts.push('Vietnamese invoices show three money totals on the "Sub-total" / "Cộng tiền hàng" / "Tổng cộng" row.');
    parts.push('You MUST read them LITERALLY from that row. Do NOT compute or sum them yourself.');
    parts.push('On multi-page invoices the "Sub-total" / "Cộng tiền hàng" row appears ONLY on the LAST page.');
    parts.push('Scan EVERY page of the PDF and use the value printed in the totals row of the LAST page.');
    parts.push('- "subtotal"    = column "Thành tiền chưa thuế GTGT" / "Amount exclusive VAT" / "Cộng tiền hàng" (pre-VAT) on the totals row.');
    parts.push('- "vat_amount"  = column "Tiền thuế GTGT" / "VAT Amount" (the tax itself, NOT the pre-tax base) on the totals row.');
    parts.push('- "total"       = "Tổng cộng tiền thanh toán" / "Thành tiền" (with VAT) on the totals row.');
    parts.push('Sanity check before returning ALL must hold; if not, re-read every page:');
    parts.push('  (a) subtotal + vat_amount === total');
    parts.push('  (b) subtotal === sum(line_items.amount)  ← if mismatched, you missed line items on another page OR read the wrong totals row.');
    parts.push('  (c) vat_amount ≈ subtotal × vat_rate / 100 (allow VND rounding within ±1)');
    parts.push('');
    parts.push('Line item rules (CRITICAL):');
    parts.push('- "product_code" = column "Mã sản phẩm" / "Part no." (e.g., "MXP63ZP/A", "MD4J4ZA/A"). Null if absent.');
    parts.push('- "amount" is PRE-TAX line total: amount = quantity × unit_price EXACTLY.');
    parts.push('- Do NOT use the with-VAT (có thuế) column for "amount".');
    parts.push('- Typical column order: "Mã sản phẩm" | "Tên hàng" | "ĐVT" | "Số lượng" | "Đơn giá" | "Thành tiền chưa thuế" | "Thuế suất" | "Tiền thuế" | "Thành tiền".');
    parts.push('- Before returning, verify: amount === quantity × unit_price. If not, re-check which column you read.');
    parts.push('- Preserve sign: if invoice is an adjustment (điều chỉnh giảm), unit_price/amount/etc. may be negative.');
    parts.push('');
    parts.push('JSON schema:');
    parts.push('{');
    parts.push('  "fields": { "<field_name>": { "value": <extracted_value>, "confidence": <0.0-1.0> } },');
    parts.push('  "line_items": [{ "product_code": "..."|null, "name": "...", "unit": "...", "quantity": <n>, "unit_price": <n>, "amount": <n>, "vat_rate": <n>|null, "vat_amount": <n>|null, "total_with_vat": <n>|null }]');
    parts.push('}');

    return parts.join('\n');
  }

  /**
   * Build the classification + extraction prompt for unknown schemas.
   * @param schemas Available schemas for classification
   * @returns Classification prompt string
   */
  private buildClassificationPrompt(schemas: SchemaData[]): string {
    const parts: string[] = [];

    parts.push('First, classify this invoice. Then extract standard fields.');
    parts.push('Return ONLY valid JSON.');
    parts.push('');

    if (schemas.length > 0) {
      parts.push('Known invoice types:');
      for (const schema of schemas) {
        const desc = schema.description ? `: ${schema.description}` : '';
        parts.push(`- "${schema.name}" (MST: ${schema.nccTaxId})${desc}`);
      }
      parts.push('');
    } else {
      parts.push('No known invoice types available. Classify as best as possible.');
      parts.push('');
    }

    parts.push('Standard fields to extract:');
    parts.push('- invoice_number (string): Số hóa đơn');
    parts.push('- invoice_symbol (string): Ký hiệu');
    parts.push('- invoice_date (date, YYYY-MM-DD): Ngày hóa đơn');
    parts.push('- seller_name (string): Tên đơn vị bán');
    parts.push('- seller_tax_id (string): MST bên bán');
    parts.push('- buyer_name (string): Tên đơn vị mua');
    parts.push('- buyer_tax_id (string): MST bên mua');
    parts.push('- subtotal (integer): pre-VAT total, column "Thành tiền chưa thuế GTGT" / "Cộng tiền hàng" (VND)');
    parts.push('- vat_rate (number): Thuế suất % (integer; 10 means 10%, not 0.1)');
    parts.push('- vat_amount (integer): column "Tiền thuế GTGT" — the tax amount only (VND)');
    parts.push('- total (integer): column "Tổng cộng tiền thanh toán" — subtotal + vat_amount (VND)');
    parts.push('');
    parts.push('Sanity check: subtotal + vat_amount === total. Negative values allowed for credit notes (điều chỉnh giảm).');
    parts.push('Line items must include product_code ("Mã sản phẩm" / "Part no."); null if column absent.');
    parts.push('');

    parts.push('JSON output format:');
    parts.push('{');
    parts.push('  "classification": { "schema_name": "...", "confidence": <0.0-1.0>, "reason": "..." },');
    parts.push('  "fields": { "<field_name>": { "value": <extracted_value>, "confidence": <0.0-1.0> } },');
    parts.push('  "line_items": [{ "product_code": "..."|null, "name": "...", "unit": "...", "quantity": <n>, "unit_price": <n>, "amount": <n>, "vat_rate": <n>|null, "vat_amount": <n>|null, "total_with_vat": <n>|null }]');
    parts.push('}');

    return parts.join('\n');
  }
}
