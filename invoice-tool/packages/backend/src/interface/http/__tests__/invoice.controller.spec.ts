import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { InvoiceController } from '../invoice.controller';
import { ApproveInvoiceUseCase } from '../../../application/review/approve-invoice.use-case';
import { RejectInvoiceUseCase } from '../../../application/review/reject-invoice.use-case';
import { EditInvoiceUseCase } from '../../../application/review/edit-invoice.use-case';
import { ReprocessInvoiceUseCase } from '../../../application/processing/reprocess-invoice.use-case';

/**
 * InvoiceController integration tests.
 */
describe('InvoiceController', () => {
  let app: INestApplication;
  const mockApproveUseCase = { execute: jest.fn() };
  const mockRejectUseCase = { execute: jest.fn() };
  const mockEditUseCase = { execute: jest.fn() };
  const mockReprocessUseCase = { execute: jest.fn() };
  const mockInvoiceRepo = {
    findById: jest.fn(),
    findByBatchId: jest.fn(),
    findRecent: jest.fn(),
    findByFileHash: jest.fn(),
    findDuplicate: jest.fn(),
    save: jest.fn(),
    updateStatus: jest.fn(),
  };
  const mockTraceRepo = {
    save: jest.fn(),
    findByInvoiceId: jest.fn(),
  };
  const mockFileStorage = {
    saveFile: jest.fn(),
    readFile: jest.fn(),
    readFileAsBase64: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: ApproveInvoiceUseCase, useValue: mockApproveUseCase },
        { provide: RejectInvoiceUseCase, useValue: mockRejectUseCase },
        { provide: EditInvoiceUseCase, useValue: mockEditUseCase },
        { provide: ReprocessInvoiceUseCase, useValue: mockReprocessUseCase },
        { provide: 'IInvoiceRepository', useValue: mockInvoiceRepo },
        { provide: 'IProcessingTraceRepository', useValue: mockTraceRepo },
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

  // Full mock invoice matching Invoice entity shape
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
    updatedAt: new Date('2026-01-01'),
    // New fields for Session 20
    lineItems: [
      { name: 'Widget A', unit: 'cái', quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 10, vatAmount: 100000, totalWithVat: 1100000 },
    ],
    ocrRawText: 'OCR text content',
    extractedRawJson: '{"invoice_number":"INV-001"}',
    fieldConfidences: '{"invoice_number":0.95,"seller_tax_id":0.88}',
    validationErrors: '{"errors":[],"warnings":[{"field":"vatRate","rule":"vat_rate_missing","message":"Minor mismatch","severity":"warning"}]}',
    classificationMethod: 'fingerprint',
    classificationConfidence: 0.92,
    storagePath: 'uploads/inv-1/invoice.pdf',
    pageCount: 2,
    fileHash: 'sha256abc123',
    poNumber: 'PO-2024-001',
    duplicateOf: null,
    processedAt: new Date('2026-01-01T01:00:00Z'),
    reviewedAt: null,
    reviewedBy: null,
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

    it('should return recent invoices without batchId filter', async () => {
      mockInvoiceRepo.findRecent.mockResolvedValue([mockInvoice]);

      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .expect(200);

      expect(mockInvoiceRepo.findRecent).toHaveBeenCalledWith(undefined, 100);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('inv-1');
    });

    it('should pass status filter to findRecent when no batchId given', async () => {
      mockInvoiceRepo.findRecent.mockResolvedValue([mockInvoice]);

      const response = await request(app.getHttpServer())
        .get('/api/invoices?status=needs_review')
        .expect(200);

      expect(mockInvoiceRepo.findRecent).toHaveBeenCalledWith('needs_review', 100);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return invoice by ID with expanded fields', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);

      const response = await request(app.getHttpServer())
        .get('/api/invoices/inv-1')
        .expect(200);

      expect(response.body.id).toBe('inv-1');
      expect(response.body.invoiceNumber).toBe('INV-001');
      // New fields
      expect(response.body.lineItems).toHaveLength(1);
      expect(response.body.lineItems[0].name).toBe('Widget A');
      expect(response.body.ocrRawText).toBe('OCR text content');
      expect(response.body.fieldConfidences).toEqual({ invoice_number: 0.95, seller_tax_id: 0.88 });
      expect(response.body.validationErrors).toEqual({
        errors: [],
        warnings: [{ field: 'vatRate', rule: 'vat_rate_missing', message: 'Minor mismatch', severity: 'warning' }],
      });
      expect(response.body.classificationMethod).toBe('fingerprint');
      expect(response.body.classificationConfidence).toBe(0.92);
      expect(response.body.storagePath).toBe('uploads/inv-1/invoice.pdf');
      expect(response.body.pageCount).toBe(2);
      expect(response.body.fileHash).toBe('sha256abc123');
      expect(response.body.poNumber).toBe('PO-2024-001');
    });

    it('should return 404 when invoice not found', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/invoices/nonexistent')
        .expect(404);
    });
  });

  describe('GET /api/invoices/:id/file', () => {
    it('should stream the original PDF file', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);
      mockFileStorage.readFile.mockResolvedValue(Buffer.from('fake-pdf-content'));

      const response = await request(app.getHttpServer())
        .get('/api/invoices/inv-1/file')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('invoice.pdf');
      expect(mockFileStorage.readFile).toHaveBeenCalledWith('uploads/inv-1/invoice.pdf');
    });

    it('should return 404 when invoice not found', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/invoices/nonexistent/file')
        .expect(404);
    });

    it('should return 404 when file not found on disk', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice);
      mockFileStorage.readFile.mockRejectedValue(new Error('File not found'));

      await request(app.getHttpServer())
        .get('/api/invoices/inv-1/file')
        .expect(404);
    });
  });

  describe('GET /api/invoices/:id/traces', () => {
    it('should return processing traces in order', async () => {
      mockTraceRepo.findByInvoiceId.mockResolvedValue([
        {
          id: 'trace-1',
          invoiceId: 'inv-1',
          stage: 'classify',
          status: 'completed',
          inputData: null,
          outputData: null,
          errorMessage: null,
          durationMs: 120,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'trace-2',
          invoiceId: 'inv-1',
          stage: 'extract',
          status: 'completed',
          inputData: null,
          outputData: '{"fields":{}}',
          errorMessage: null,
          durationMs: 3000,
          createdAt: new Date('2026-01-01T00:00:01Z'),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/invoices/inv-1/traces')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].stage).toBe('classify');
      expect(response.body[0].durationMs).toBe(120);
      expect(response.body[1].stage).toBe('extract');
      expect(response.body[1].outputData).toBe('{"fields":{}}');
    });

    it('should return empty array for invoice with no traces', async () => {
      mockTraceRepo.findByInvoiceId.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/invoices/inv-1/traces')
        .expect(200);

      expect(response.body).toEqual([]);
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

  describe('POST /api/invoices/:id/reprocess', () => {
    it('should reprocess an invoice', async () => {
      mockReprocessUseCase.execute.mockResolvedValue({
        invoiceId: 'inv-1',
        previousStatus: 'approved',
        newStatus: 'pending',
      });

      const response = await request(app.getHttpServer())
        .post('/api/invoices/inv-1/reprocess')
        .expect(201);

      expect(response.body.invoiceId).toBe('inv-1');
      expect(response.body.previousStatus).toBe('approved');
      expect(response.body.newStatus).toBe('pending');
    });
  });
});
