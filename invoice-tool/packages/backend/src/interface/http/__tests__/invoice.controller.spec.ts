import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { InvoiceController } from '../invoice.controller';
import { ApproveInvoiceUseCase } from '../../../application/review/approve-invoice.use-case';
import { RejectInvoiceUseCase } from '../../../application/review/reject-invoice.use-case';
import { EditInvoiceUseCase } from '../../../application/review/edit-invoice.use-case';

/**
 * InvoiceController integration tests.
 */
describe('InvoiceController', () => {
  let app: INestApplication;
  const mockApproveUseCase = { execute: jest.fn() };
  const mockRejectUseCase = { execute: jest.fn() };
  const mockEditUseCase = { execute: jest.fn() };
  const mockInvoiceRepo = {
    findById: jest.fn(),
    findByBatchId: jest.fn(),
    findByFileHash: jest.fn(),
    findDuplicate: jest.fn(),
    save: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: ApproveInvoiceUseCase, useValue: mockApproveUseCase },
        { provide: RejectInvoiceUseCase, useValue: mockRejectUseCase },
        { provide: EditInvoiceUseCase, useValue: mockEditUseCase },
        { provide: 'IInvoiceRepository', useValue: mockInvoiceRepo },
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

  const mockInvoice = {
    id: 'inv-1',
    batchId: 'batch-1',
    status: 'needs_review',
    invoiceNumber: 'INV-001',
    invoiceSymbol: 'AA/24E',
    invoiceDate: '2024-01-15',
    invoiceType: 'original',
    sellerName: 'ABC Corp',
    sellerTaxId: '0302861742',
    buyerName: 'Viettel',
    buyerTaxId: '0100109106',
    subtotal: 1000000,
    vatRate: 10,
    vatAmount: 100000,
    total: 1100000,
    overallConfidence: 0.85,
    schemaId: 'schema-1',
    originalFilename: 'invoice.pdf',
    createdAt: new Date('2026-01-01'),
  };

  describe('GET /api/invoices', () => {
    it('should return invoices filtered by batchId', async () => {
      mockInvoiceRepo.findByBatchId.mockResolvedValue([mockInvoice]);

      const response = await request(app.getHttpServer())
        .get('/api/invoices?batchId=batch-1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('inv-1');
      expect(response.body[0].confidenceScore).toBe(0.85);
    });

    it('should return empty array without batchId filter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return invoice by ID', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);

      const response = await request(app.getHttpServer())
        .get('/api/invoices/inv-1')
        .expect(200);

      expect(response.body.id).toBe('inv-1');
      expect(response.body.invoiceNumber).toBe('INV-001');
    });

    it('should return 404 when invoice not found', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/invoices/nonexistent')
        .expect(404);
    });
  });

  describe('POST /api/invoices/:id/approve', () => {
    it('should approve an invoice', async () => {
      mockApproveUseCase.execute.mockResolvedValue({
        invoiceId: 'inv-1',
        previousStatus: 'needs_review',
        newStatus: 'approved',
      });

      const response = await request(app.getHttpServer())
        .post('/api/invoices/inv-1/approve')
        .send({ reviewedBy: 'operator-1' })
        .expect(201);

      expect(response.body.invoiceId).toBe('inv-1');
      expect(response.body.newStatus).toBe('approved');
    });

    it('should return 400 when reviewedBy is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices/inv-1/approve')
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/invoices/:id/reject', () => {
    it('should reject an invoice with reason', async () => {
      mockRejectUseCase.execute.mockResolvedValue({
        invoiceId: 'inv-1',
        previousStatus: 'needs_review',
        newStatus: 'error',
      });

      const response = await request(app.getHttpServer())
        .post('/api/invoices/inv-1/reject')
        .send({ reviewedBy: 'operator-1', reason: 'Data mismatch' })
        .expect(201);

      expect(response.body.newStatus).toBe('error');
    });

    it('should return 400 when reason is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices/inv-1/reject')
        .send({ reviewedBy: 'operator-1', reason: '' })
        .expect(400);
    });
  });

  describe('PUT /api/invoices/:id', () => {
    it('should edit invoice fields', async () => {
      mockEditUseCase.execute.mockResolvedValue({
        invoiceId: 'inv-1',
        updatedFields: ['invoiceNumber', 'total'],
      });

      const response = await request(app.getHttpServer())
        .put('/api/invoices/inv-1')
        .send({ changes: { invoiceNumber: 'INV-002', total: 2000000 } })
        .expect(200);

      expect(response.body.updatedFields).toEqual(['invoiceNumber', 'total']);
    });
  });
});
