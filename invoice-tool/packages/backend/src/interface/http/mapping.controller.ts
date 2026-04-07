import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateMappingUseCase } from '../../application/mapping/create-mapping.use-case';
import type { IMappingRepository } from '../../domain/mapping/mapping.repository';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { MappingResponseDto } from './dto/mapping-response.dto';

/**
 * MappingController — handles product mapping endpoints.
 * Thin controller: delegates to use cases and repositories.
 */
@ApiTags('Mappings')
@Controller('mappings')
export class MappingController {
  constructor(
    private readonly createMappingUseCase: CreateMappingUseCase,
    @Inject('IMappingRepository') private readonly mappingRepo: IMappingRepository,
  ) {}

  /**
   * Create a new product mapping.
   * @param dto - Mapping creation parameters
   * @returns Created mapping info
   */
  @Post()
  @ApiOperation({ summary: 'Create a product mapping' })
  @ApiResponse({ status: 201, type: MappingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or schema not found' })
  async createMapping(@Body() dto: CreateMappingDto): Promise<MappingResponseDto> {
    const result = await this.createMappingUseCase.execute({
      schemaId: dto.schemaId,
      partnerProductName: dto.partnerProductName,
      viettelProductCode: dto.viettelProductCode,
      viettelProductName: dto.viettelProductName,
      source: dto.source,
      confidence: dto.confidence,
    });
    return {
      id: result.mappingId,
      schemaId: dto.schemaId,
      partnerProductName: result.partnerProductName,
      viettelProductCode: result.viettelProductCode,
      viettelProductName: dto.viettelProductName ?? null,
      status: result.status,
      source: dto.source,
      confidence: dto.confidence ?? null,
    };
  }

  /**
   * List mappings for a specific schema.
   * @param schemaId - Schema ID to filter by
   * @returns Array of mappings
   */
  @Get()
  @ApiOperation({ summary: 'List mappings for a schema' })
  @ApiQuery({ name: 'schemaId', required: true, description: 'Schema ID to filter by' })
  @ApiResponse({ status: 200, type: [MappingResponseDto] })
  async listMappings(@Query('schemaId') schemaId: string): Promise<MappingResponseDto[]> {
    const mappings = await this.mappingRepo.findBySchemaId(schemaId);
    return mappings.map(m => ({
      id: m.id,
      schemaId: m.schemaId,
      partnerProductName: m.partnerProductName,
      viettelProductCode: m.viettelProductCode ?? '',
      viettelProductName: m.viettelProductName,
      status: m.status,
      source: m.source,
      confidence: m.confidence,
    }));
  }
}
