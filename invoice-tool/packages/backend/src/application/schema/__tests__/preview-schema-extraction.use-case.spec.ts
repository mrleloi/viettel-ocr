import { PreviewSchemaExtractionUseCase } from '../preview-schema-extraction.use-case';
import type { ISchemaRepository } from '../../../domain/schema/schema.repository';
import type { IFieldDefinitionRepository } from '../../../domain/schema/field-definition.repository';
import type { IOcrService } from '../../../domain/processing/ocr.service';
import { Schema } from '../../../domain/schema/schema.entity';
import { FieldDefinition } from '../../../domain/schema/field-definition.entity';

function createSchema(): Schema {
  return Schema.create({
    name: 'Digiworld',
    nccName: 'Digiworld Corp',
    nccTaxId: '0302861742',
    description: 'Test schema',
  });
}

function createFieldDef(schemaId: string): FieldDefinition {
  return FieldDefinition.create({
    schemaId,
    fieldName: 'invoice_number',
    displayName: 'Số hóa đơn',
    dataType: 'string',
    isRequired: true,
    extractionHint: 'Look for "Số hóa đơn" label',
    sortOrder: 0,
  });
}

describe('PreviewSchemaExtractionUseCase', () => {
  let sut: PreviewSchemaExtractionUseCase;
  let schemaRepo: jest.Mocked<ISchemaRepository>;
  let fieldDefRepo: jest.Mocked<IFieldDefinitionRepository>;
  let ocrService: jest.Mocked<IOcrService>;

  beforeEach(() => {
    schemaRepo = {
      findById: jest.fn(),
      findActive: jest.fn(),
      findByNccTaxId: jest.fn(),
      save: jest.fn(),
    };
    fieldDefRepo = {
      findBySchemaId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    ocrService = {
      extract: jest.fn(),
      extractAndClassify: jest.fn(),
    };
    sut = new PreviewSchemaExtractionUseCase(schemaRepo, fieldDefRepo, ocrService);
  });

  describe('execute', () => {
    it('should extract fields from a PDF using the schema field list', async () => {
      const schema = createSchema();
      const field = createFieldDef(schema.id);
      schemaRepo.findById.mockResolvedValue(schema);
      fieldDefRepo.findBySchemaId.mockResolvedValue([field]);
      ocrService.extract.mockResolvedValue({
        rawText: 'Invoice text content',
        extractedData: { invoice_number: '0001/2026' },
        fieldConfidences: { invoice_number: 0.95 },
      });

      const result = await sut.execute({
        schemaId: schema.id,
        fileContent: Buffer.from('%PDF-1.4 test content'),
      });

      expect(result.schemaId).toBe(schema.id);
      expect(result.schemaName).toBe('Digiworld');
      expect(result.extractedFields).toEqual({ invoice_number: '0001/2026' });
      expect(result.rawText).toBe('Invoice text content');
      expect(result.fieldConfidences).toEqual({ invoice_number: 0.95 });
    });

    it('should pass base64-encoded file content to the OCR service', async () => {
      const schema = createSchema();
      schemaRepo.findById.mockResolvedValue(schema);
      fieldDefRepo.findBySchemaId.mockResolvedValue([]);
      ocrService.extract.mockResolvedValue({
        rawText: '',
        extractedData: {},
        fieldConfidences: {},
      });

      const fileContent = Buffer.from('PDF binary data here');
      await sut.execute({ schemaId: schema.id, fileContent });

      const expectedBase64 = fileContent.toString('base64');
      expect(ocrService.extract).toHaveBeenCalledWith(expectedBase64, expect.any(String));
    });

    it('should include field names in the extraction prompt', async () => {
      const schema = createSchema();
      const field = createFieldDef(schema.id);
      schemaRepo.findById.mockResolvedValue(schema);
      fieldDefRepo.findBySchemaId.mockResolvedValue([field]);
      ocrService.extract.mockResolvedValue({
        rawText: '',
        extractedData: {},
        fieldConfidences: {},
      });

      await sut.execute({ schemaId: schema.id, fileContent: Buffer.from('%PDF') });

      const [, prompt] = ocrService.extract.mock.calls[0];
      expect(prompt).toContain('invoice_number');
    });

    it('should work with no field definitions (empty schema)', async () => {
      const schema = createSchema();
      schemaRepo.findById.mockResolvedValue(schema);
      fieldDefRepo.findBySchemaId.mockResolvedValue([]);
      ocrService.extract.mockResolvedValue({
        rawText: 'Some text',
        extractedData: {},
        fieldConfidences: {},
      });

      const result = await sut.execute({
        schemaId: schema.id,
        fileContent: Buffer.from('%PDF-test'),
      });

      expect(result.extractedFields).toEqual({});
      expect(ocrService.extract).toHaveBeenCalledTimes(1);
    });

    it('should throw DomainError when schema is not found', async () => {
      schemaRepo.findById.mockResolvedValue(null);

      await expect(
        sut.execute({ schemaId: 'nonexistent', fileContent: Buffer.from('test') }),
      ).rejects.toThrow(/Schema not found/);
    });

    it('should propagate OCR service errors', async () => {
      const schema = createSchema();
      schemaRepo.findById.mockResolvedValue(schema);
      fieldDefRepo.findBySchemaId.mockResolvedValue([]);
      ocrService.extract.mockRejectedValue(new Error('Gemini API error'));

      await expect(
        sut.execute({ schemaId: schema.id, fileContent: Buffer.from('%PDF') }),
      ).rejects.toThrow('Gemini API error');
    });
  });
});
