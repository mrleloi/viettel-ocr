import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ProductController } from '../product.controller';
import { SyncProductsUseCase } from '../../../application/product/sync-products.use-case';

/**
 * ProductController integration tests.
 */
describe('ProductController', () => {
  let app: INestApplication;
  const mockSyncProductsUseCase = { execute: jest.fn() };
  const mockProductRepo = {
    findById: jest.fn(),
    findByCode: jest.fn(),
    findAll: jest.fn(),
    search: jest.fn(),
    save: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: SyncProductsUseCase, useValue: mockSyncProductsUseCase },
        { provide: 'IProductRepository', useValue: mockProductRepo },
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

  describe('POST /api/products/sync', () => {
    it('should sync products from API', async () => {
      mockSyncProductsUseCase.execute.mockResolvedValue({
        totalFetched: 10,
        created: 5,
        updated: 3,
        conflictsDetected: 0,
      });

      const response = await request(app.getHttpServer())
        .post('/api/products/sync')
        .expect(201);

      expect(response.body.totalFetched).toBe(10);
      expect(response.body.created).toBe(5);
    });
  });

  describe('GET /api/products', () => {
    it('should list all products', async () => {
      mockProductRepo.findAll.mockResolvedValue([
        {
          id: 'prod-1',
          productCode: 'VT-001',
          productName: 'Laptop Viettel',
          category: 'Electronics',
          syncStatus: 'synced',
          lastSyncedAt: new Date('2026-01-01'),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].productCode).toBe('VT-001');
      expect(response.body[0].syncStatus).toBe('synced');
    });
  });
});
