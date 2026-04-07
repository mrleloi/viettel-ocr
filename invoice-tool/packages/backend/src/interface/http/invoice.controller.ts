import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ApproveInvoiceUseCase } from '../../application/review/approve-invoice.use-case';
import { RejectInvoiceUseCase } from '../../application/review/reject-invoice.use-case';
import { EditInvoiceUseCase } from '../../application/review/edit-invoice.use-case';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import { ApproveInvoiceDto } from './dto/approve-invoice.dto';
import { RejectInvoiceDto } from './dto/reject-invoice.dto';
import { EditInvoiceDto } from './dto/edit-invoice.dto';
import {
  InvoiceResponseDto,
  InvoiceActionResponseDto,
  InvoiceEditResponseDto,
} from './dto/invoice-response.dto';

/**
 * InvoiceController — handles invoice listing, review actions, and editing.
 * Thin controller: delegates all logic to use cases and repositories.
 */
@ApiTags('Invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly approveUseCase: ApproveInvoiceUseCase,
    private readonly rejectUseCase: RejectInvoiceUseCase,
    private readonly editUseCase: EditInvoiceUseCase,
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
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
    } else {
      invoices = [];
    }

    if (status) {
      invoices = invoices.filter(inv => inv.status === status);
    }

    return invoices.map(inv => this.toResponseDto(inv));
  }

  /**
   * Get a single invoice by ID.
   * @param id - Invoice ID
   * @returns Invoice details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID' })
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
   * Map an invoice entity to a response DTO.
   * @param inv - Invoice entity
   * @returns Response DTO
   */
  private toResponseDto(inv: {
    id: string;
    batchId: string;
    status: string;
    invoiceNumber: string | null;
    invoiceSymbol: string | null;
    invoiceDate: string | null;
    invoiceType: string | null;
    sellerName: string | null;
    sellerTaxId: string | null;
    buyerName: string | null;
    buyerTaxId: string | null;
    subtotal: number | null;
    vatRate: number | null;
    vatAmount: number | null;
    total: number | null;
    overallConfidence: number | null;
    schemaId: string | null;
    originalFilename: string;
    createdAt: Date;
  }): InvoiceResponseDto {
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
    };
  }
}
