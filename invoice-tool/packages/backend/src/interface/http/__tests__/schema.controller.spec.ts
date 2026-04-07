import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SchemaController } from '../schema.controller';
import { CreateSchemaUseCase } from '../../../application/schema/create-schema.use-case';
import { UpdateSchemaUseCase } from '../../../application/schema/update-schema.use-case';

/**
 * SchemaController integration tests.
 */
describe('SchemaController', () => {
  let app: INestApplication;
  const mockCreateSchemaUseCase = { execute: jest.fn() };
  const mockUpdateSchemaUseCase = { execute: jest.fn() };
  const mockSchemaRepo = {
    findById: jest.fn(),
    findActive: jest.fn(),
    findByNccTaxId: jest.fn(),
    save: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [
        { provide: CreateSchemaUseCase, useValue: mockCreateSchemaUseCase },
        { provide: UpdateSchemaUseCase, useValue: mockUpdateSchemaUseCase },
        { provide: 'ISchemaRepository', useValue: mockSchemaRepo },
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
});
