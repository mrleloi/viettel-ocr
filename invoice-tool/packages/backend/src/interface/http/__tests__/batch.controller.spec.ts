import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BatchController } from '../batch.controller';
import { UploadBatchUseCase } from '../../../application/upload/upload-batch.use-case';

/**
 * BatchController integration tests.
 * Uses mocked use case and repository to test HTTP layer in isolation.
 */
describe('BatchController', () => {
  let app: INestApplication;
  const mockUploadBatchUseCase = {
    execute: jest.fn(),
  };
  const mockBatchRepo = {
    findRecent: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    updateCounters: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        { provide: UploadBatchUseCase, useValue: mockUploadBatchUseCase },
        { provide: 'IBatchRepository', useValue: mockBatchRepo },
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

  describe('GET /api/batches', () => {
    it('should return list of recent batches', async () => {
      const mockBatch = {
        id: 'batch-1',
        status: 'completed',
        uploadMode: 'single_ncc',
        totalFiles: 3,
        processedFiles: 3,
        successFiles: 2,
        errorFiles: 1,
        hintSchemaId: null,
        createdAt: new Date('2026-01-01'),
      };
      mockBatchRepo.findRecent.mockResolvedValue([mockBatch]);

      const response = await request(app.getHttpServer())
        .get('/api/batches')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('batch-1');
      expect(response.body[0].status).toBe('completed');
      expect(response.body[0].totalFiles).toBe(3);
      expect(mockBatchRepo.findRecent).toHaveBeenCalledWith(50);
    });
  });

  describe('GET /api/batches/:id', () => {
    it('should return batch by ID', async () => {
      const mockBatch = {
        id: 'batch-1',
        status: 'processing',
        uploadMode: 'mixed',
        totalFiles: 5,
        processedFiles: 2,
        successFiles: 1,
        errorFiles: 1,
        hintSchemaId: 'schema-1',
        createdAt: new Date('2026-01-01'),
      };
      mockBatchRepo.findById.mockResolvedValue(mockBatch);

      const response = await request(app.getHttpServer())
        .get('/api/batches/batch-1')
        .expect(200);

      expect(response.body.id).toBe('batch-1');
      expect(response.body.uploadMode).toBe('mixed');
    });

    it('should return 404 for non-existent batch', async () => {
      mockBatchRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/batches/nonexistent')
        .expect(404);
    });
  });

  describe('POST /api/batches', () => {
    it('should return 400 when no files provided', async () => {
      await request(app.getHttpServer())
        .post('/api/batches')
        .field('uploadMode', 'single_ncc')
        .expect(400);
    });

    it('should create batch with uploaded files', async () => {
      mockUploadBatchUseCase.execute.mockResolvedValue({
        batchId: 'batch-new',
        totalFiles: 1,
        acceptedFiles: 1,
        rejectedFiles: 0,
        duplicateFiles: 0,
        results: [{ filename: 'test.pdf', status: 'accepted', invoiceId: 'inv-1' }],
      });

      const response = await request(app.getHttpServer())
        .post('/api/batches')
        .field('uploadMode', 'single_ncc')
        .attach('files', Buffer.from('fake-pdf'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(201);

      expect(response.body.batchId).toBe('batch-new');
      expect(response.body.acceptedFiles).toBe(1);
    });
  });
});
