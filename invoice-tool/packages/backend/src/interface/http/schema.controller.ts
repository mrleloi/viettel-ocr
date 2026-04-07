import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { CreateSchemaUseCase } from '../../application/schema/create-schema.use-case';
import { UpdateSchemaUseCase } from '../../application/schema/update-schema.use-case';
import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import { CreateSchemaDto } from './dto/create-schema.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { SchemaResponseDto, CreateSchemaResponseDto } from './dto/schema-response.dto';

/**
 * SchemaController — handles schema CRUD endpoints.
 * Thin controller: delegates all logic to use cases and repositories.
 */
@ApiTags('Schemas')
@Controller('schemas')
export class SchemaController {
  constructor(
    private readonly createSchemaUseCase: CreateSchemaUseCase,
    private readonly updateSchemaUseCase: UpdateSchemaUseCase,
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
  ) {}

  /**
   * Create a new schema with optional rules and fields.
   * @param dto - Schema creation parameters
   * @returns Created schema info
   */
  @Post()
  @ApiOperation({ summary: 'Create a new schema' })
  @ApiResponse({ status: 201, type: CreateSchemaResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or duplicate tax ID' })
  async createSchema(@Body() dto: CreateSchemaDto): Promise<CreateSchemaResponseDto> {
    const result = await this.createSchemaUseCase.execute({
      name: dto.name,
      nccName: dto.nccName,
      nccTaxId: dto.nccTaxId,
      description: dto.description,
      promptTemplate: dto.promptTemplate,
      fingerprintRules: dto.fingerprintRules,
      fieldDefinitions: dto.fieldDefinitions,
    });
    return {
      schemaId: result.schemaId,
      name: result.name,
      status: result.status,
      rulesCreated: result.rulesCreated,
      fieldsCreated: result.fieldsCreated,
    };
  }

  /**
   * List all active schemas.
   * @returns Array of active schemas
   */
  @Get()
  @ApiOperation({ summary: 'List active schemas' })
  @ApiResponse({ status: 200, type: [SchemaResponseDto] })
  async listSchemas(): Promise<SchemaResponseDto[]> {
    const schemas = await this.schemaRepo.findActive();
    return schemas.map(s => ({
      id: s.id,
      name: s.name,
      nccName: s.nccName,
      nccTaxId: s.nccTaxId,
      status: s.status,
      description: s.description,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  /**
   * Get a single schema by ID.
   * @param id - Schema ID
   * @returns Schema details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a schema by ID' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 200, type: SchemaResponseDto })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  async getSchema(@Param('id') id: string): Promise<SchemaResponseDto> {
    const schema = await this.schemaRepo.findById(id);
    if (!schema) {
      throw new NotFoundException(`Schema not found: ${id}`);
    }
    return {
      id: schema.id,
      name: schema.name,
      nccName: schema.nccName,
      nccTaxId: schema.nccTaxId,
      status: schema.status,
      description: schema.description,
      createdAt: schema.createdAt.toISOString(),
    };
  }

  /**
   * Update a schema.
   * @param id - Schema ID
   * @param dto - Update parameters
   * @returns Updated schema info
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a schema' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 200, type: SchemaResponseDto })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  async updateSchema(
    @Param('id') id: string,
    @Body() dto: UpdateSchemaDto,
  ): Promise<{ schemaId: string; name: string; status: string }> {
    const result = await this.updateSchemaUseCase.execute({
      schemaId: id,
      name: dto.name,
      description: dto.description,
      nccName: dto.nccName,
      promptTemplate: dto.promptTemplate,
      statusAction: dto.statusAction,
    });
    return {
      schemaId: result.schemaId,
      name: result.name,
      status: result.status,
    };
  }
}
