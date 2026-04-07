import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MappingController } from '../mapping.controller';
import { CreateMappingUseCase } from '../../../application/mapping/create-mapping.use-case';

/**
 * MappingController integration tests.
 */
describe('MappingController', () => {
  let app: INestApplication;
  const mockCreateMappingUseCase = { execute: jest.fn() };
  const mockMappingRepo = {
    findByPartnerName: jest.fn(),
    findBySchemaId: jest.fn(),
    save: jest.fn(),
    incrementUsage: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MappingController],
      providers: [
        { provide: CreateMappingUseCase, useValue: mockCreateMappingUseCase },
        { provide: 'IMappingRepository', useValue: mockMappingRepo },
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

  describe('POST /api/mappings', () => {
    it('should create a product mapping', async () => {
      mockCreateMappingUseCase.execute.mockResolvedValue({
        mappingId: 'map-1',
        partnerProductName: 'Laptop Dell XPS 15',
        viettelProductCode: 'VT-LAPTOP-001',
        status: 'active',
      });

      const response = await request(app.getHttpServer())
        .post('/api/mappings')
        .send({
          schemaId: 'schema-1',
          partnerProductName: 'Laptop Dell XPS 15',
          viettelProductCode: 'VT-LAPTOP-001',
          source: 'manual',
          confidence: 1.0,
        })
        .expect(201);

      expect(response.body.id).toBe('map-1');
      expect(response.body.partnerProductName).toBe('Laptop Dell XPS 15');
    });

    it('should return 400 for invalid source', async () => {
      await request(app.getHttpServer())
        .post('/api/mappings')
        .send({
          schemaId: 'schema-1',
          partnerProductName: 'Test',
          viettelProductCode: 'VT-001',
          source: 'invalid_source',
        })
        .expect(400);
    });
  });

  describe('GET /api/mappings', () => {
    it('should list mappings for a schema', async () => {
      mockMappingRepo.findBySchemaId.mockResolvedValue([
        {
          id: 'map-1',
          schemaId: 'schema-1',
          partnerProductName: 'Laptop Dell',
          viettelProductCode: 'VT-001',
          viettelProductName: 'Laptop Viettel',
          status: 'active',
          source: 'manual',
          confidence: 1.0,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/mappings?schemaId=schema-1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].partnerProductName).toBe('Laptop Dell');
    });
  });
});
