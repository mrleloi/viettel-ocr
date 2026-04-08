import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Inject,
  Res,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApproveInvoiceUseCase } from '../../application/review/approve-invoice.use-case';
import { RejectInvoiceUseCase } from '../../application/review/reject-invoice.use-case';
import { EditInvoiceUseCase } from '../../application/review/edit-invoice.use-case';
import { ReprocessInvoiceUseCase } from '../../application/processing/reprocess-invoice.use-case';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IProcessingTraceRepository } from '../../domain/processing/processing-trace.repository';
import type { IFileStorage } from '../../domain/shared/file-storage';
import type { Invoice } from '../../domain/invoice/invoice.entity';
import type { InvoiceStatus } from '@invoice-tool/shared';
import { ApproveInvoiceDto } from './dto/approve-invoice.dto';
import { RejectInvoiceDto } from './dto/reject-invoice.dto';
import { EditInvoiceDto } from './dto/edit-invoice.dto';
import {
  InvoiceResponseDto,
  InvoiceActionResponseDto,
  InvoiceEditResponseDto,
} from './dto/invoice-response.dto';
import { ProcessingTraceResponseDto } from './dto/processing-trace-response.dto';

/**
 * InvoiceController — handles invoice listing, review actions, editing,
 * file serving, and processing trace queries.
 * Thin controller: delegates all logic to use cases and repositories.
 */
@ApiTags('Invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly approveUseCase: ApproveInvoiceUseCase,
    private readonly rejectUseCase: RejectInvoiceUseCase,
    private readonly editUseCase: EditInvoiceUseCase,
    private readonly reprocessUseCase: ReprocessInvoiceUseCase,
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IProcessingTraceRepository') private readonly traceRepo: IProcessingTraceRepository,
    @Inject('IFileStorage') private readonly fileStorage: IFileStorage,
  ) {}

  /**
   * List invoices, optionally filtered by batch ID or status.
   * @param batchId - Optional batch ID filter
   * @param status - Optional status filter
   * @returns Array of invoices
   */
  @Get()
  @ApiOperation({ summary: 'List invoices with optional filters' })
  @ApiQuery({ name: 'batchId', required: false, description: 'Filter by batch ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, type: [InvoiceResponseDto] })
  async listInvoices(
    @Query('batchId') batchId?: string,
    @Query('status') status?: string,
  ): Promise<InvoiceResponseDto[]> {
    let invoices: Awaited<ReturnType<IInvoiceRepository['findByBatchId']>>;
    if (batchId) {
      invoices = await this.invoiceRepo.findByBatchId(batchId);
      if (status) {
        invoices = invoices.filter(inv => inv.status === status);
      }
    } else {
      invoices = await this.invoiceRepo.findRecent(
        status as InvoiceStatus | undefined,
        100,
      );
    }

    return invoices.map(inv => this.toResponseDto(inv));
  }

  /**
   * Get a single invoice by ID with full detail.
   * @param id - Invoice ID
   * @returns Invoice details including line items, confidences, and raw data
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID with full detail' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Param('id') id: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${id}`);
    }
    return this.toResponseDto(invoice);
  }

  /**
   * Download the original invoice file (PDF).
   * @param id - Invoice ID
   * @param res - Express Response for setting headers
   * @returns Streamable file of the original PDF
   */
  @Get(':id/file')
  @ApiOperation({ summary: 'Download original invoice file' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Original invoice file' })
  @ApiResponse({ status: 404, description: 'Invoice or file not found' })
  async getInvoiceFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${id}`);
    }

    try {
      const buffer = await this.fileStorage.readFile(invoice.storagePath);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.originalFilename}"`,
      });
      return new StreamableFile(buffer);
    } catch {
      throw new NotFoundException(`Invoice file not found at: ${invoice.storagePath}`);
    }
  }

  /**
   * Get processing trace for an invoice (pipeline stage timings).
   * @param id - Invoice ID
   * @returns Array of processing trace records in chronological order
   */
  @Get(':id/traces')
  @ApiOperation({ summary: 'Get processing trace for an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: [ProcessingTraceResponseDto] })
  async getInvoiceTraces(
    @Param('id') id: string,
  ): Promise<ProcessingTraceResponseDto[]> {
    const traces = await this.traceRepo.findByInvoiceId(id);
    return traces.map(t => ({
      id: t.id,
      invoiceId: t.invoiceId,
      stage: t.stage,
      status: t.status,
      inputData: t.inputData,
      outputData: t.outputData,
      errorMessage: t.errorMessage,
      durationMs: t.durationMs,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /**
   * Approve an invoice after review.
   * @param id - Invoice ID
   * @param dto - Approval parameters
   * @returns Approval result
   */
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an invoice after review' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: InvoiceActionResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveInvoiceDto,
  ): Promise<InvoiceActionResponseDto> {
    const result = await this.approveUseCase.execute({
      invoiceId: id,
      reviewedBy: dto.reviewedBy,
      reviewerNote: dto.notes,
    });
    return {
      invoiceId: result.invoiceId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
    };
  }

  /**
   * Reject an invoice during review.
   * @param id - Invoice ID
   * @param dto - Rejection parameters
   * @returns Rejection result
   */
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an invoice during review' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: InvoiceActionResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectInvoiceDto,
  ): Promise<InvoiceActionResponseDto> {
    const result = await this.rejectUseCase.execute({
      invoiceId: id,
      reviewedBy: dto.reviewedBy,
      reason: dto.reason,
    });
    return {
      invoiceId: result.invoiceId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
    };
  }

  /**
   * Edit fields on an invoice in review.
   * @param id - Invoice ID
   * @param dto - Edit parameters
   * @returns Edit result
   */
  @Put(':id')
  @ApiOperation({ summary: 'Edit extracted data on an invoice in review' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: InvoiceEditResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async editInvoice(
    @Param('id') id: string,
    @Body() dto: EditInvoiceDto,
  ): Promise<InvoiceEditResponseDto> {
    const result = await this.editUseCase.execute({
      invoiceId: id,
      changes: dto.changes,
    });
    return {
      invoiceId: result.invoiceId,
      updatedFields: result.updatedFields,
    };
  }

  /**
   * Reprocess an invoice (re-run the pipeline).
   * @param id - Invoice ID
   * @returns Reprocess result
   */
  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Reprocess an invoice (re-run pipeline)' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: InvoiceActionResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async reprocess(
    @Param('id') id: string,
  ): Promise<InvoiceActionResponseDto> {
    const result = await this.reprocessUseCase.execute({ invoiceId: id });
    return {
      invoiceId: result.invoiceId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
    };
  }

  /**
   * Map an invoice entity to a response DTO with all fields.
   * @param inv - Invoice entity
   * @returns Response DTO
   */
  private toResponseDto(inv: Invoice): InvoiceResponseDto {
    // Parse JSON fields safely
    let fieldConfidences: Record<string, number> | null = null;
    if (inv.fieldConfidences) {
      try { fieldConfidences = JSON.parse(inv.fieldConfidences); } catch { /* ignore */ }
    }

    let validationErrors: { errors: string[]; warnings: string[] } | null = null;
    if (inv.validationErrors) {
      try { validationErrors = JSON.parse(inv.validationErrors); } catch { /* ignore */ }
    }

    return {
      id: inv.id,
      batchId: inv.batchId,
      status: inv.status,
      invoiceNumber: inv.invoiceNumber,
      invoiceSymbol: inv.invoiceSymbol,
      invoiceDate: inv.invoiceDate,
      invoiceType: inv.invoiceType,
      sellerName: inv.sellerName,
      sellerTaxId: inv.sellerTaxId,
      buyerName: inv.buyerName,
      buyerTaxId: inv.buyerTaxId,
      subtotal: inv.subtotal,
      vatRate: inv.vatRate,
      vatAmount: inv.vatAmount,
      total: inv.total,
      confidenceScore: inv.overallConfidence,
      schemaId: inv.schemaId,
      originalFilename: inv.originalFilename,
      createdAt: inv.createdAt.toISOString(),
      // New fields (Session 20)
      lineItems: inv.lineItems?.length
        ? inv.lineItems.map(li => ({
            name: li.name,
            unit: li.unit ?? null,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: li.amount,
            vatRate: li.vatRate ?? null,
            vatAmount: li.vatAmount ?? null,
            totalWithVat: li.totalWithVat ?? null,
          }))
        : null,
      ocrRawText: inv.ocrRawText,
      extractedRawJson: inv.extractedRawJson,
      fieldConfidences,
      validationErrors,
      classificationMethod: inv.classificationMethod,
      classificationConfidence: inv.classificationConfidence,
      storagePath: inv.storagePath,
      pageCount: inv.pageCount,
      fileHash: inv.fileHash,
      poNumber: inv.poNumber,
      duplicateOf: inv.duplicateOf,
      processedAt: inv.processedAt?.toISOString() ?? null,
      reviewedAt: inv.reviewedAt?.toISOString() ?? null,
      reviewedBy: inv.reviewedBy,
      updatedAt: inv.updatedAt.toISOString(),
    };
  }
}
