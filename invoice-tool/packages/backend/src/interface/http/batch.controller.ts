import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { UploadBatchUseCase } from '../../application/upload/upload-batch.use-case';
import type { IBatchRepository } from '../../domain/batch/batch.repository';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BatchResponseDto, UploadBatchResponseDto } from './dto/batch-response.dto';

/**
 * BatchController — handles batch upload and listing endpoints.
 * Thin controller: delegates all logic to use cases and repositories.
 */
@ApiTags('Batches')
@Controller('batches')
export class BatchController {
  constructor(
    private readonly uploadBatchUseCase: UploadBatchUseCase,
    @Inject('IBatchRepository') private readonly batchRepo: IBatchRepository,
  ) {}

  /**
   * Upload files to create a new batch.
   * @param files - Uploaded PDF files
   * @param dto - Batch creation parameters
   * @returns Upload result with per-file status
   */
  @Post()
  @UseInterceptors(FilesInterceptor('files', 500))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload files to create a new batch' })
  @ApiResponse({ status: 201, type: UploadBatchResponseDto })
  @ApiResponse({ status: 400, description: 'No files provided or invalid upload mode' })
  async createBatch(
    @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; mimetype: string }>,
    @Body() dto: CreateBatchDto,
  ): Promise<UploadBatchResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const result = await this.uploadBatchUseCase.execute({
      files: files.map(f => ({
        filename: f.originalname,
        content: f.buffer,
        mimeType: f.mimetype,
      })),
      uploadMode: dto.uploadMode,
      hintSchemaId: dto.hintSchemaId,
    });

    return {
      batchId: result.batchId,
      totalFiles: result.totalFiles,
      acceptedFiles: result.acceptedFiles,
      rejectedFiles: result.rejectedFiles,
      duplicateFiles: result.duplicateFiles,
    };
  }

  /**
   * List recent batches.
   * @returns Array of recent batches
   */
  @Get()
  @ApiOperation({ summary: 'List recent batches' })
  @ApiResponse({ status: 200, type: [BatchResponseDto] })
  async listBatches(): Promise<BatchResponseDto[]> {
    const batches = await this.batchRepo.findRecent(50);
    return batches.map(b => ({
      id: b.id,
      status: b.status,
      uploadMode: b.uploadMode,
      totalFiles: b.totalFiles,
      processedFiles: b.processedFiles,
      successFiles: b.successFiles,
      errorFiles: b.errorFiles,
      hintSchemaId: b.hintSchemaId,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  /**
   * Get a single batch by ID.
   * @param id - Batch ID
   * @returns Batch details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a batch by ID' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, type: BatchResponseDto })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatch(@Param('id') id: string): Promise<BatchResponseDto> {
    const batch = await this.batchRepo.findById(id);
    if (!batch) {
      throw new NotFoundException(`Batch not found: ${id}`);
    }
    return {
      id: batch.id,
      status: batch.status,
      uploadMode: batch.uploadMode,
      totalFiles: batch.totalFiles,
      processedFiles: batch.processedFiles,
      successFiles: batch.successFiles,
      errorFiles: batch.errorFiles,
      hintSchemaId: batch.hintSchemaId,
      createdAt: batch.createdAt.toISOString(),
    };
  }
}
