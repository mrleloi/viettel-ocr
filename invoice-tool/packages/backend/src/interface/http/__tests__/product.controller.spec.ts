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
  const mockConflictRepo = {
    findUnresolved: jest.fn(),
    save: jest.fn(),
    resolve: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: SyncProductsUseCase, useValue: mockSyncProductsUseCase },
        { provide: 'IProductRepository', useValue: mockProductRepo },
        { provide: 'ISyncConflictRepository', useValue: mockConflictRepo },
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
    mockConflictRepo.findUnresolved.mockResolvedValue([]);
    mockConflictRepo.resolve.mockResolvedValue(undefined);
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

  describe('GET /api/products/conflicts', () => {
    it('should return empty array when no conflicts', async () => {
      mockConflictRepo.findUnresolved.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/products/conflicts')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return list of unresolved conflicts', async () => {
      mockConflictRepo.findUnresolved.mockResolvedValue([
        {
          id: 'conflict-1',
          productId: 'prod-1',
          fieldName: 'productName',
          localValue: 'Laptop A',
          remoteValue: 'Laptop B',
          createdAt: new Date('2026-04-01'),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/products/conflicts')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('conflict-1');
      expect(response.body[0].fieldName).toBe('productName');
      expect(response.body[0].localValue).toBe('Laptop A');
    });
  });

  describe('POST /api/products/conflicts/:id/resolve', () => {
    it('should resolve conflict with keep_local', async () => {
      mockConflictRepo.resolve.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/products/conflicts/conflict-1/resolve')
        .send({ action: 'keep_local' })
        .expect(200);

      expect(mockConflictRepo.resolve).toHaveBeenCalledWith('conflict-1', 'keep_local');
    });

    it('should resolve conflict with accept_remote', async () => {
      mockConflictRepo.resolve.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/products/conflicts/conflict-1/resolve')
        .send({ action: 'accept_remote' })
        .expect(200);

      expect(mockConflictRepo.resolve).toHaveBeenCalledWith('conflict-1', 'accept_remote');
    });

    it('should treat ignore as keep_local', async () => {
      mockConflictRepo.resolve.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/products/conflicts/conflict-1/resolve')
        .send({ action: 'ignore' })
        .expect(200);

      expect(mockConflictRepo.resolve).toHaveBeenCalledWith('conflict-1', 'keep_local');
    });

    it('should reject invalid action', async () => {
      await request(app.getHttpServer())
        .post('/api/products/conflicts/conflict-1/resolve')
        .send({ action: 'invalid_action' })
        .expect(400);
    });
  });
});
