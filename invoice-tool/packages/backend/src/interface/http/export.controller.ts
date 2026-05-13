import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateExportUseCase } from '../../application/export/create-export.use-case';
import type { IFileStorage } from '../../domain/shared/file-storage';
import { CreateExportDto } from './dto/create-export.dto';
import { ExportResponseDto } from './dto/export-response.dto';

/**
 * ExportController — handles export creation and download endpoints.
 * Thin controller: delegates to use cases and file storage.
 */
@ApiTags('Exports')
@Controller('exports')
export class ExportController {
  constructor(
    private readonly createExportUseCase: CreateExportUseCase,
    @Inject('IFileStorage') private readonly fileStorage: IFileStorage,
  ) {}

  /**
   * Create a new export job.
   * @param dto - Export parameters
   * @returns Export metadata
   */
  @Post()
  @ApiOperation({ summary: 'Create a new export' })
  @ApiResponse({ status: 201, type: ExportResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid export format' })
  async createExport(@Body() dto: CreateExportDto): Promise<ExportResponseDto> {
    const result = await this.createExportUseCase.execute({
      format: dto.format,
      batchId: dto.batchId,
      schemaId: dto.schemaId,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      processedFrom: dto.processedFrom,
      processedTo: dto.processedTo,
      statusFilter: dto.statusFilter,
    });
    return {
      exportId: result.exportId,
      filename: result.filename,
      recordCount: result.recordCount,
      fileSizeBytes: result.fileSizeBytes,
    };
  }

  /**
   * Download an exported file.
   * @param id - Export ID (used as filename base)
   * @returns File stream
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Download an export file' })
  @ApiParam({ name: 'id', description: 'Export ID' })
  @ApiResponse({ status: 200, description: 'File download' })
  @ApiResponse({ status: 404, description: 'Export file not found' })
  async downloadExport(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    let content: Buffer | null = null;
    let filename = '';

    for (const ext of ['xlsx', 'csv', 'json']) {
      const path = `exports/${id}.${ext}`;
      try {
        content = await this.fileStorage.readFile(path);
        filename = `${id}.${ext}`;
        break;
      } catch {
        // Try next extension
      }
    }

    if (!content) {
      throw new NotFoundException(`Export file not found: ${id}`);
    }

    const contentType = filename.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : filename.endsWith('.csv')
        ? 'text/csv; charset=utf-8'
        : 'application/json';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(content);
  }
}
