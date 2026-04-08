import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SchemaController } from '../schema.controller';
import { CreateSchemaUseCase } from '../../../application/schema/create-schema.use-case';
import { UpdateSchemaUseCase } from '../../../application/schema/update-schema.use-case';
import { PreviewSchemaExtractionUseCase } from '../../../application/schema/preview-schema-extraction.use-case';
import { FieldDefinition } from '../../../domain/schema/field-definition.entity';
import { FingerprintRule } from '../../../domain/schema/fingerprint-rule.entity';

function createMockField() {
  return FieldDefinition.create({
    schemaId: 'schema-1',
    fieldName: 'invoice_number',
    displayName: 'Số hóa đơn',
    dataType: 'string',
    isRequired: true,
    sortOrder: 0,
  });
}

function createMockRule() {
  return FingerprintRule.create({
    schemaId: 'schema-1',
    ruleType: 'mst_exact',
    pattern: '0302861742',
    priority: 1,
  });
}

/**
 * SchemaController integration tests.
 */
describe('SchemaController', () => {
  let app: INestApplication;
  const mockCreateSchemaUseCase = { execute: jest.fn() };
  const mockUpdateSchemaUseCase = { execute: jest.fn() };
  const mockPreviewUseCase = { execute: jest.fn() };
  const mockSchemaRepo = {
    findById: jest.fn(),
    findActive: jest.fn(),
    findByNccTaxId: jest.fn(),
    save: jest.fn(),
  };
  const mockFieldRepo = {
    findBySchemaId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const mockRuleRepo = {
    findBySchemaId: jest.fn(),
    findAllActive: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [
        { provide: CreateSchemaUseCase, useValue: mockCreateSchemaUseCase },
        { provide: UpdateSchemaUseCase, useValue: mockUpdateSchemaUseCase },
        { provide: PreviewSchemaExtractionUseCase, useValue: mockPreviewUseCase },
        { provide: 'ISchemaRepository', useValue: mockSchemaRepo },
        { provide: 'IFieldDefinitionRepository', useValue: mockFieldRepo },
        { provide: 'IFingerprintRuleRepository', useValue: mockRuleRepo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Schema CRUD ───────────────────────────────────────────────────────────

  describe('POST /api/schemas', () => {
    it('should create a schema', async () => {
      mockCreateSchemaUseCase.execute.mockResolvedValue({
        schemaId: 'schema-1',
        name: 'Digiworld',
        status: 'draft',
        rulesCreated: 1,
        fieldsCreated: 2,
      });

      const response = await request(app.getHttpServer())
        .post('/api/schemas')
        .send({
          name: 'Digiworld',
          nccName: 'Digiworld Corp',
          nccTaxId: '0302861742',
          fingerprintRules: [{ ruleType: 'mst_exact', pattern: '0302861742', priority: 1 }],
          fieldDefinitions: [
            { fieldName: 'invoiceNumber', displayName: 'Số hóa đơn', dataType: 'string', isRequired: true },
            { fieldName: 'total', displayName: 'Tổng tiền', dataType: 'number', isRequired: true },
          ],
        })
        .expect(201);

      expect(response.body.schemaId).toBe('schema-1');
      expect(response.body.rulesCreated).toBe(1);
      expect(response.body.fieldsCreated).toBe(2);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/schemas')
        .send({ name: 'Test' }) // missing nccName and nccTaxId
        .expect(400);
    });
  });

  describe('GET /api/schemas', () => {
    it('should return active schemas', async () => {
      mockSchemaRepo.findActive.mockResolvedValue([
        {
          id: 'schema-1',
          name: 'Digiworld',
          nccName: 'Digiworld Corp',
          nccTaxId: '0302861742',
          status: 'active',
          description: 'Test schema',
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/schemas')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Digiworld');
    });
  });

  describe('GET /api/schemas/:id', () => {
    it('should return schema by ID', async () => {
      mockSchemaRepo.findById.mockResolvedValue({
        id: 'schema-1',
        name: 'Digiworld',
        nccName: 'Digiworld Corp',
        nccTaxId: '0302861742',
        status: 'active',
        description: null,
        createdAt: new Date('2026-01-01'),
      });

      const response = await request(app.getHttpServer())
        .get('/api/schemas/schema-1')
        .expect(200);

      expect(response.body.id).toBe('schema-1');
    });

    it('should return 404 for non-existent schema', async () => {
      mockSchemaRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/schemas/nonexistent')
        .expect(404);
    });
  });

  describe('PUT /api/schemas/:id', () => {
    it('should update a schema', async () => {
      mockUpdateSchemaUseCase.execute.mockResolvedValue({
        schemaId: 'schema-1',
        name: 'Updated Name',
        status: 'active',
      });

      const response = await request(app.getHttpServer())
        .put('/api/schemas/schema-1')
        .send({ name: 'Updated Name', statusAction: 'activate' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });
  });

  // ─── Field Definition CRUD ─────────────────────────────────────────────────

  describe('GET /api/schemas/:id/fields', () => {
    it('should list field definitions for a schema', async () => {
      const field = createMockField();
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockFieldRepo.findBySchemaId.mockResolvedValue([field]);

      const response = await request(app.getHttpServer())
        .get('/api/schemas/schema-1/fields')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].fieldName).toBe('invoice_number');
      expect(response.body[0].displayName).toBe('Số hóa đơn');
      expect(response.body[0].dataType).toBe('string');
      expect(response.body[0].isRequired).toBe(true);
    });

    it('should return 404 when schema does not exist', async () => {
      mockSchemaRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/schemas/nonexistent/fields')
        .expect(404);
    });
  });

  describe('POST /api/schemas/:id/fields', () => {
    it('should create a field definition', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockFieldRepo.save.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/api/schemas/schema-1/fields')
        .send({
          fieldName: 'seller_name',
          displayName: 'Tên người bán',
          dataType: 'string',
          isRequired: true,
          sortOrder: 1,
        })
        .expect(201);

      expect(response.body.fieldName).toBe('seller_name');
      expect(response.body.displayName).toBe('Tên người bán');
      expect(mockFieldRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should return 400 for invalid data type', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });

      await request(app.getHttpServer())
        .post('/api/schemas/schema-1/fields')
        .send({
          fieldName: 'test',
          displayName: 'Test',
          dataType: 'invalid_type',
          isRequired: false,
          sortOrder: 0,
        })
        .expect(400);
    });

    it('should return 404 when schema does not exist', async () => {
      mockSchemaRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/schemas/nonexistent/fields')
        .send({
          fieldName: 'test',
          displayName: 'Test',
          dataType: 'string',
          isRequired: false,
          sortOrder: 0,
        })
        .expect(404);
    });
  });

  describe('PUT /api/schemas/:id/fields/:fieldId', () => {
    it('should update a field definition', async () => {
      const field = createMockField();
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockFieldRepo.findBySchemaId.mockResolvedValue([field]);
      mockFieldRepo.save.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .put(`/api/schemas/schema-1/fields/${field.id}`)
        .send({ displayName: 'Updated Label', isRequired: false })
        .expect(200);

      expect(response.body.displayName).toBe('Updated Label');
      expect(mockFieldRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should return 404 when field does not exist', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockFieldRepo.findBySchemaId.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put('/api/schemas/schema-1/fields/nonexistent')
        .send({ displayName: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/schemas/:id/fields/:fieldId', () => {
    it('should delete a field definition', async () => {
      const field = createMockField();
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockFieldRepo.findBySchemaId.mockResolvedValue([field]);
      mockFieldRepo.delete.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .delete(`/api/schemas/schema-1/fields/${field.id}`)
        .expect(200);

      expect(response.body.deleted).toBe(true);
      expect(mockFieldRepo.delete).toHaveBeenCalledWith(field.id);
    });
  });

  // ─── Fingerprint Rule CRUD ─────────────────────────────────────────────────

  describe('GET /api/schemas/:id/fingerprint-rules', () => {
    it('should list fingerprint rules for a schema', async () => {
      const rule = createMockRule();
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockRuleRepo.findBySchemaId.mockResolvedValue([rule]);

      const response = await request(app.getHttpServer())
        .get('/api/schemas/schema-1/fingerprint-rules')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].ruleType).toBe('mst_exact');
      expect(response.body[0].pattern).toBe('0302861742');
      expect(response.body[0].priority).toBe(1);
      expect(response.body[0].isActive).toBe(true);
    });

    it('should return 404 when schema does not exist', async () => {
      mockSchemaRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/schemas/nonexistent/fingerprint-rules')
        .expect(404);
    });
  });

  describe('POST /api/schemas/:id/fingerprint-rules', () => {
    it('should create a fingerprint rule', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockRuleRepo.save.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/api/schemas/schema-1/fingerprint-rules')
        .send({ ruleType: 'keyword', pattern: 'DIGIWORLD', priority: 2 })
        .expect(201);

      expect(response.body.ruleType).toBe('keyword');
      expect(response.body.pattern).toBe('DIGIWORLD');
      expect(mockRuleRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should return 400 for invalid rule type', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });

      await request(app.getHttpServer())
        .post('/api/schemas/schema-1/fingerprint-rules')
        .send({ ruleType: 'invalid', pattern: 'test', priority: 0 })
        .expect(400);
    });
  });

  describe('PUT /api/schemas/:id/fingerprint-rules/:ruleId', () => {
    it('should update a fingerprint rule', async () => {
      const rule = createMockRule();
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockRuleRepo.findBySchemaId.mockResolvedValue([rule]);
      mockRuleRepo.save.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .put(`/api/schemas/schema-1/fingerprint-rules/${rule.id}`)
        .send({ priority: 5, isActive: false })
        .expect(200);

      expect(response.body.priority).toBe(5);
      expect(response.body.isActive).toBe(false);
    });

    it('should return 404 when rule does not exist', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockRuleRepo.findBySchemaId.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put('/api/schemas/schema-1/fingerprint-rules/nonexistent')
        .send({ priority: 5 })
        .expect(404);
    });
  });

  describe('DELETE /api/schemas/:id/fingerprint-rules/:ruleId', () => {
    it('should delete a fingerprint rule', async () => {
      const rule = createMockRule();
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockRuleRepo.findBySchemaId.mockResolvedValue([rule]);
      mockRuleRepo.delete.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .delete(`/api/schemas/schema-1/fingerprint-rules/${rule.id}`)
        .expect(200);

      expect(response.body.deleted).toBe(true);
      expect(mockRuleRepo.delete).toHaveBeenCalledWith(rule.id);
    });
  });

  // ─── Schema Preview ────────────────────────────────────────────────────────

  describe('POST /api/schemas/:id/preview', () => {
    it('should return extraction preview for a valid PDF', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });
      mockPreviewUseCase.execute.mockResolvedValue({
        schemaId: 'schema-1',
        schemaName: 'Digiworld',
        extractedFields: { invoice_number: '0001/2026', total: 5000000 },
        rawText: 'Raw invoice OCR text',
        fieldConfidences: { invoice_number: 0.95, total: 0.88 },
      });

      const response = await request(app.getHttpServer())
        .post('/api/schemas/schema-1/preview')
        .attach('file', Buffer.from('%PDF-1.4 test'), 'sample.pdf')
        .expect(200);

      expect(response.body.schemaId).toBe('schema-1');
      expect(response.body.schemaName).toBe('Digiworld');
      expect(response.body.extractedFields.invoice_number).toBe('0001/2026');
      expect(response.body.rawText).toBe('Raw invoice OCR text');
      expect(mockPreviewUseCase.execute).toHaveBeenCalledWith({
        schemaId: 'schema-1',
        fileContent: expect.any(Buffer),
      });
    });

    it('should return 400 when no file is provided', async () => {
      mockSchemaRepo.findById.mockResolvedValue({ id: 'schema-1' });

      await request(app.getHttpServer())
        .post('/api/schemas/schema-1/preview')
        .expect(400);
    });

    it('should return 404 when schema does not exist', async () => {
      mockSchemaRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/schemas/nonexistent/preview')
        .attach('file', Buffer.from('%PDF-test'), 'sample.pdf')
        .expect(404);
    });
  });
});
