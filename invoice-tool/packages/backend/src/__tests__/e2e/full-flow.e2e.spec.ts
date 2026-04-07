import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BatchController } from '../../interface/http/batch.controller';
import { InvoiceController } from '../../interface/http/invoice.controller';
import { ExportController } from '../../interface/http/export.controller';
import { HealthController } from '../../interface/http/health.controller';
import { UploadBatchUseCase } from '../../application/upload/upload-batch.use-case';
import { ApproveInvoiceUseCase } from '../../application/review/approve-invoice.use-case';
import { RejectInvoiceUseCase } from '../../application/review/reject-invoice.use-case';
import { EditInvoiceUseCase } from '../../application/review/edit-invoice.use-case';
import { CreateExportUseCase } from '../../application/export/create-export.use-case';

/**
 * E2E Test — Full API Flow
 *
 * Tests the complete lifecycle:
 *   1. Health check
 *   2. Upload batch (POST /api/batches)
 *   3. List batches (GET /api/batches)
 *   4. Get batch by ID (GET /api/batches/:id)
 *   5. List invoices (GET /api/invoices)
 *   6. Approve invoice (POST /api/invoices/:id/approve)
 *   7. Create export (POST /api/exports)
 *
 * Uses mocked use cases and repositories to validate
 * the full controller chain and data transformation.
 */
describe('E2E: Full Invoice Flow', () => {
  let app: INestApplication;

  // Mock state to simulate a simple in-memory store
  const batches: Record<string, unknown> = {};
  const invoices: Record<string, Record<string, unknown>> = {};

  // Mock repositories
  const mockBatchRepo = {
    findRecent: jest.fn().mockImplementation(() => Object.values(batches)),
    findById: jest.fn().mockImplementation((id: string) => batches[id] ?? null),
    save: jest.fn(),
    updateCounters: jest.fn(),
  };

  const mockInvoiceRepo = {
    findByBatchId: jest.fn().mockImplementation((batchId: string) =>
      Object.values(invoices).filter((inv) => inv.batchId === batchId),
    ),
    findById: jest.fn().mockImplementation((id: string) => invoices[id] ?? null),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockFileStorage = {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    fileExists: jest.fn(),
    deleteFile: jest.fn(),
    getAbsolutePath: jest.fn(),
  };

  // Mock use cases
  const mockUploadBatch = {
    execute: jest.fn().mockImplementation(async () => {
      const batchId = 'batch-e2e-1';
      const invoiceId = 'inv-e2e-1';
      batches[batchId] = {
        id: batchId,
        status: 'processing',
        uploadMode: 'single_ncc',
        totalFiles: 1,
        processedFiles: 0,
        successFiles: 0,
        errorFiles: 0,
        hintSchemaId: null,
        createdAt: new Date('2026-04-07'),
      };
      invoices[invoiceId] = {
        id: invoiceId,
        batchId,
        status: 'needs_review',
        invoiceNumber: 'HD/2026/E2E',
        invoiceSymbol: null,
        invoiceDate: '2026-04-07',
        invoiceType: null,
        sellerName: 'Digiworld Corp',
        sellerTaxId: '0302861742',
        buyerName: 'Viettel',
        buyerTaxId: '0100109106',
        subtotal: 10000000,
        vatRate: 0.1,
        vatAmount: 1000000,
        total: 11000000,
        overallConfidence: 0.85,
        schemaId: 'schema-1',
        originalFilename: 'test.pdf',
        createdAt: new Date('2026-04-07'),
      };
      return {
        batchId,
        totalFiles: 1,
        acceptedFiles: 1,
        rejectedFiles: 0,
        duplicateFiles: 0,
        results: [{ filename: 'test.pdf', status: 'accepted', invoiceId }],
      };
    }),
  };

  const mockApproveInvoice = {
    execute: jest.fn().mockImplementation(async (input: { invoiceId: string }) => {
      const inv = invoices[input.invoiceId];
      if (inv) {
        inv.status = 'approved';
      }
      return {
        invoiceId: input.invoiceId,
        previousStatus: 'needs_review',
        newStatus: 'approved',
      };
    }),
  };

  const mockRejectInvoice = {
    execute: jest.fn(),
  };

  const mockEditInvoice = {
    execute: jest.fn(),
  };

  const mockCreateExport = {
    execute: jest.fn().mockResolvedValue({
      exportId: 'exp-e2e-1',
      filename: 'export-2026-04-07.csv',
      recordCount: 1,
      fileSizeBytes: 256,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        HealthController,
        BatchController,
        InvoiceController,
        ExportController,
      ],
      providers: [
        { provide: UploadBatchUseCase, useValue: mockUploadBatch },
        { provide: ApproveInvoiceUseCase, useValue: mockApproveInvoice },
        { provide: RejectInvoiceUseCase, useValue: mockRejectInvoice },
        { provide: EditInvoiceUseCase, useValue: mockEditInvoice },
        { provide: CreateExportUseCase, useValue: mockCreateExport },
        { provide: 'IBatchRepository', useValue: mockBatchRepo },
        { provide: 'IInvoiceRepository', useValue: mockInvoiceRepo },
        { provide: 'IFileStorage', useValue: mockFileStorage },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Step 1: Health Check ──
  it('Step 1: GET /api/health should return OK', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
  });

  // ── Step 2: Upload Batch ──
  it('Step 2: POST /api/batches should create a batch', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/batches')
      .field('uploadMode', 'single_ncc')
      .attach('files', Buffer.from('fake-pdf-content'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body.batchId).toBe('batch-e2e-1');
    expect(response.body.acceptedFiles).toBe(1);
    expect(response.body.totalFiles).toBe(1);
  });

  // ── Step 3: List Batches ──
  it('Step 3: GET /api/batches should list the created batch', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/batches')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(1);

    const batch = response.body.find(
      (b: Record<string, unknown>) => b.id === 'batch-e2e-1',
    );
    expect(batch).toBeDefined();
    expect(batch.status).toBe('processing');
  });

  // ── Step 4: Get Batch by ID ──
  it('Step 4: GET /api/batches/:id should return batch details', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/batches/batch-e2e-1')
      .expect(200);

    expect(response.body.id).toBe('batch-e2e-1');
    expect(response.body.totalFiles).toBe(1);
  });

  // ── Step 5: List Invoices ──
  it('Step 5: GET /api/invoices?batchId=... should list invoices', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/invoices?batchId=batch-e2e-1')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('inv-e2e-1');
    expect(response.body[0].status).toBe('needs_review');
    expect(response.body[0].invoiceNumber).toBe('HD/2026/E2E');
    expect(response.body[0].sellerName).toBe('Digiworld Corp');
  });

  // ── Step 6: Approve Invoice ──
  it('Step 6: POST /api/invoices/:id/approve should approve the invoice', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/invoices/inv-e2e-1/approve')
      .send({ reviewedBy: 'operator@viettel.vn', notes: 'E2E test approval' })
      .expect(201);

    expect(response.body.invoiceId).toBe('inv-e2e-1');
    expect(response.body.previousStatus).toBe('needs_review');
    expect(response.body.newStatus).toBe('approved');
  });

  // ── Step 7: Create Export ──
  it('Step 7: POST /api/exports should create an export', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/exports')
      .send({ format: 'csv' })
      .expect(201);

    expect(response.body.exportId).toBe('exp-e2e-1');
    expect(response.body.filename).toBe('export-2026-04-07.csv');
    expect(response.body.recordCount).toBe(1);
    expect(response.body.fileSizeBytes).toBe(256);
  });

  // ── Step 8: Verify full flow completed ──
  it('Step 8: Full flow — upload → list → approve → export completed', () => {
    // Verify all use cases were called in correct order
    expect(mockUploadBatch.execute).toHaveBeenCalledTimes(1);
    expect(mockApproveInvoice.execute).toHaveBeenCalledTimes(1);
    expect(mockCreateExport.execute).toHaveBeenCalledTimes(1);

    // Verify the in-memory state
    expect(invoices['inv-e2e-1'].status).toBe('approved');
  });
});
