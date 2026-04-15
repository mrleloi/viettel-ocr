import {
  PromptBuilder,
  SchemaData,
  FieldData,
} from '../prompt-builder.service';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  /**
   * Factory for creating sample schema data.
   */
  function createSchema(overrides?: Partial<SchemaData>): SchemaData {
    return {
      id: 'schema-1',
      name: 'Digiworld',
      description: 'Hóa đơn từ Digiworld',
      nccName: 'Công ty Digiworld',
      nccTaxId: '0302861742',
      promptTemplate: null,
      ...overrides,
    };
  }

  /**
   * Factory for creating sample field definitions.
   */
  function createFields(): FieldData[] {
    return [
      {
        fieldName: 'invoice_number',
        displayName: 'Số hóa đơn',
        dataType: 'string',
        isRequired: true,
        extractionHint: 'Located in top-right corner, format: XXXXXXX',
        outputKey: 'invoiceNumber',
      },
      {
        fieldName: 'invoice_date',
        displayName: 'Ngày hóa đơn',
        dataType: 'date',
        isRequired: true,
        extractionHint: null,
        outputKey: null,
      },
      {
        fieldName: 'total',
        displayName: 'Tổng cộng tiền thanh toán',
        dataType: 'integer',
        isRequired: true,
        extractionHint: 'Bottom of invoice, in VND',
        outputKey: 'total',
      },
      {
        fieldName: 'po_number',
        displayName: 'Số PO',
        dataType: 'string',
        isRequired: false,
        extractionHint: 'May not be present on all invoices',
        outputKey: null,
      },
    ];
  }

  describe('buildKnownSchemaPrompt', () => {
    // ✅ Happy: Known schema with custom template → includes template
    it('should include custom prompt template when provided', () => {
      const schema = createSchema({
        promptTemplate: 'Extract data focusing on line items with detailed product codes.',
      });
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      expect(result.systemPrompt).toBeDefined();
      expect(result.extractionPrompt).toContain('Extract data focusing on line items');
      expect(result.extractionPrompt.length).toBeGreaterThan(0);
    });

    // ✅ Happy: Known schema with field definitions → lists all fields
    it('should list all field definitions in extraction prompt', () => {
      const schema = createSchema();
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      expect(result.extractionPrompt).toContain('invoice_number');
      expect(result.extractionPrompt).toContain('invoice_date');
      expect(result.extractionPrompt).toContain('total');
      expect(result.extractionPrompt).toContain('po_number');
    });

    // ✅ Edge: Schema with no custom template → uses default
    it('should use default template when promptTemplate is null', () => {
      const schema = createSchema({ promptTemplate: null });
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      // Should still produce a valid prompt
      expect(result.systemPrompt.length).toBeGreaterThan(0);
      expect(result.extractionPrompt.length).toBeGreaterThan(0);
      // Should contain JSON output instruction
      expect(result.extractionPrompt).toContain('JSON');
    });

    // ✅ Edge: Fields with extraction hints → includes hints in prompt
    it('should include extraction hints when provided', () => {
      const schema = createSchema();
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      expect(result.extractionPrompt).toContain('Located in top-right corner');
      expect(result.extractionPrompt).toContain('Bottom of invoice, in VND');
    });

    // ✅ Edge: Required vs optional fields → marked correctly
    it('should mark required fields differently from optional ones', () => {
      const schema = createSchema();
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      // "invoice_number" is required, "po_number" is optional
      // The prompt should distinguish between them
      expect(result.extractionPrompt).toMatch(/invoice_number.*required|required.*invoice_number/i);
    });

    // ❌ Error: Empty field list → still produces valid prompt
    it('should produce valid prompt even with empty field list', () => {
      const schema = createSchema();
      const result = builder.buildKnownSchemaPrompt(schema, []);

      expect(result.systemPrompt.length).toBeGreaterThan(0);
      expect(result.extractionPrompt.length).toBeGreaterThan(0);
      expect(result.extractionPrompt).toContain('JSON');
    });
  });

  describe('buildUnknownSchemaPrompt', () => {
    // ✅ Happy: Unknown schema with multiple schema options → lists schemas
    it('should list all schema options for classification', () => {
      const schemas = [
        createSchema({ id: 's1', name: 'Digiworld', nccTaxId: '0302861742' }),
        createSchema({ id: 's2', name: 'Samsung', nccTaxId: '0301234567', description: 'Samsung Vina invoices' }),
        createSchema({ id: 's3', name: 'FPT', nccTaxId: '0105678901', description: 'FPT Trading invoices' }),
      ];
      const result = builder.buildUnknownSchemaPrompt(schemas);

      expect(result.extractionPrompt).toContain('Digiworld');
      expect(result.extractionPrompt).toContain('Samsung');
      expect(result.extractionPrompt).toContain('FPT');
      // Should include MST for identification
      expect(result.extractionPrompt).toContain('0302861742');
    });

    // ❌ Error: Unknown schema mode with empty schemas → still valid
    it('should produce valid prompt even with empty schema list', () => {
      const result = builder.buildUnknownSchemaPrompt([]);

      expect(result.systemPrompt.length).toBeGreaterThan(0);
      expect(result.extractionPrompt.length).toBeGreaterThan(0);
      expect(result.extractionPrompt).toContain('JSON');
    });
  });

  describe('prompt content', () => {
    // Vietnamese context included
    it('should include Vietnamese field name context', () => {
      const schema = createSchema();
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      // Should contain Vietnamese display names
      expect(result.extractionPrompt).toContain('Số hóa đơn');
      expect(result.extractionPrompt).toContain('Ngày hóa đơn');
    });

    // JSON output instruction
    it('should instruct model to return JSON only', () => {
      const schema = createSchema();
      const fields = createFields();
      const result = builder.buildKnownSchemaPrompt(schema, fields);

      expect(result.extractionPrompt).toMatch(/JSON/i);
    });
  });
});
