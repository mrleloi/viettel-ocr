import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ExportController } from '../export.controller';
import { CreateExportUseCase } from '../../../application/export/create-export.use-case';

/**
 * ExportController integration tests.
 */
describe('ExportController', () => {
  let app: INestApplication;
  const mockCreateExportUseCase = { execute: jest.fn() };
  const mockFileStorage = {
    saveFile: jest.fn(),
    readFile: jest.fn(),
    readFileAsBase64: jest.fn(),
    fileExists: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn(),
    ensureDir: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        { provide: CreateExportUseCase, useValue: mockCreateExportUseCase },
        { provide: 'IFileStorage', useValue: mockFileStorage },
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

  describe('POST /api/exports', () => {
    it('should create a CSV export', async () => {
      mockCreateExportUseCase.execute.mockResolvedValue({
        exportId: 'exp-123',
        filename: 'exp-123.csv',
        recordCount: 10,
        fileSizeBytes: 1024,
      });

      const response = await request(app.getHttpServer())
        .post('/api/exports')
        .send({ format: 'csv', batchId: 'batch-1' })
        .expect(201);

      expect(response.body.exportId).toBe('exp-123');
      expect(response.body.recordCount).toBe(10);
    });

    it('should create an XLSX export', async () => {
      mockCreateExportUseCase.execute.mockResolvedValue({
        exportId: 'exp-xlsx-1',
        filename: 'exp-xlsx-1.xlsx',
        recordCount: 5,
        fileSizeBytes: 4096,
      });

      const response = await request(app.getHttpServer())
        .post('/api/exports')
        .send({ format: 'xlsx', batchId: 'batch-1' })
        .expect(201);

      expect(response.body.filename).toContain('.xlsx');
    });

    it('should return 400 for invalid format', async () => {
      await request(app.getHttpServer())
        .post('/api/exports')
        .send({ format: 'pdf' })
        .expect(400);
    });
  });

  describe('GET /api/exports/:id/download', () => {
    it('should download a CSV export file', async () => {
      const csvContent = 'id,invoiceNumber\ninv-1,INV-001';
      mockFileStorage.readFile.mockImplementation((path: string) => {
        if (path.endsWith('.csv')) return Promise.resolve(Buffer.from(csvContent));
        return Promise.reject(new Error('not found'));
      });

      const response = await request(app.getHttpServer())
        .get('/api/exports/exp-123/download')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('exp-123.csv');
    });

    it('should download an XLSX export file with spreadsheet MIME type', async () => {
      const xlsxContent = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
      mockFileStorage.readFile.mockImplementation((path: string) => {
        if (path.endsWith('.xlsx')) return Promise.resolve(xlsxContent);
        return Promise.reject(new Error('not found'));
      });

      const response = await request(app.getHttpServer())
        .get('/api/exports/exp-xlsx-1/download')
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('exp-xlsx-1.xlsx');
    });

    it('should return 404 when export file not found', async () => {
      mockFileStorage.readFile.mockRejectedValue(new Error('File not found'));

      await request(app.getHttpServer())
        .get('/api/exports/nonexistent/download')
        .expect(404);
    });
  });
});
