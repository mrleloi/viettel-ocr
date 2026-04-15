import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Inject,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { CreateSchemaUseCase } from '../../application/schema/create-schema.use-case';
import { UpdateSchemaUseCase } from '../../application/schema/update-schema.use-case';
import { PreviewSchemaExtractionUseCase } from '../../application/schema/preview-schema-extraction.use-case';
import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import type { IFieldDefinitionRepository } from '../../domain/schema/field-definition.repository';
import type { IFingerprintRuleRepository } from '../../domain/schema/fingerprint-rule.repository';
import { FieldDefinition } from '../../domain/schema/field-definition.entity';
import { FingerprintRule } from '../../domain/schema/fingerprint-rule.entity';
import { CreateSchemaDto } from './dto/create-schema.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { SchemaResponseDto, CreateSchemaResponseDto, PreviewSchemaResponseDto } from './dto/schema-response.dto';
import {
  CreateFieldDefinitionDto,
  UpdateFieldDefinitionDto,
  FieldDefinitionResponseDto,
} from './dto/field-definition.dto';
import {
  CreateFingerprintRuleDto,
  UpdateFingerprintRuleDto,
  FingerprintRuleResponseDto,
} from './dto/fingerprint-rule.dto';

/**
 * SchemaController — handles schema, field definition, and fingerprint rule CRUD.
 * Thin controller: delegates all logic to use cases and repositories.
 */
@ApiTags('Schemas')
@Controller('schemas')
export class SchemaController {
  constructor(
    private readonly createSchemaUseCase: CreateSchemaUseCase,
    private readonly updateSchemaUseCase: UpdateSchemaUseCase,
    private readonly previewUseCase: PreviewSchemaExtractionUseCase,
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
    @Inject('IFieldDefinitionRepository') private readonly fieldRepo: IFieldDefinitionRepository,
    @Inject('IFingerprintRuleRepository') private readonly ruleRepo: IFingerprintRuleRepository,
  ) {}

  // ═══════════════════════════════════════════
  // Schema CRUD
  // ═══════════════════════════════════════════

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
      id: result.schemaId,
      name: result.name,
      status: result.status,
      rulesCreated: result.rulesCreated,
      fieldsCreated: result.fieldsCreated,
    };
  }

  /**
   * List all schemas (active + draft).
   * @returns Array of non-archived schemas
   */
  @Get()
  @ApiOperation({ summary: 'List all schemas' })
  @ApiResponse({ status: 200, type: [SchemaResponseDto] })
  async listSchemas(): Promise<SchemaResponseDto[]> {
    const schemas = await this.schemaRepo.findAll();
    return schemas.map(s => ({
      id: s.id,
      name: s.name,
      nccName: s.nccName,
      nccTaxId: s.nccTaxId,
      status: s.status,
      description: s.description,
      version: s.version ?? 1,
      createdAt: s.createdAt.toISOString(),
      updatedAt: (s.updatedAt ?? s.createdAt).toISOString(),
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
      version: schema.version ?? 1,
      createdAt: schema.createdAt.toISOString(),
      updatedAt: (schema.updatedAt ?? schema.createdAt).toISOString(),
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
  ): Promise<SchemaResponseDto> {
    await this.updateSchemaUseCase.execute({
      schemaId: id,
      name: dto.name,
      description: dto.description,
      nccName: dto.nccName,
      promptTemplate: dto.promptTemplate,
      statusAction: dto.statusAction,
    });
    // Re-fetch to return full SchemaResponseDto shape
    const schema = await this.schemaRepo.findById(id);
    if (!schema) {
      throw new NotFoundException(`Schema not found after update: ${id}`);
    }
    return {
      id: schema.id,
      name: schema.name,
      nccName: schema.nccName,
      nccTaxId: schema.nccTaxId,
      status: schema.status,
      description: schema.description,
      version: schema.version ?? 1,
      createdAt: schema.createdAt.toISOString(),
      updatedAt: (schema.updatedAt ?? schema.createdAt).toISOString(),
    };
  }

  // ═══════════════════════════════════════════
  // Field Definition CRUD
  // ═══════════════════════════════════════════

  /**
   * List field definitions for a schema.
   * @param schemaId - Schema ID
   * @returns Array of field definitions ordered by sortOrder
   */
  @Get(':id/fields')
  @ApiOperation({ summary: 'List field definitions for a schema' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 200, type: [FieldDefinitionResponseDto] })
  async listFields(@Param('id') schemaId: string): Promise<FieldDefinitionResponseDto[]> {
    await this.ensureSchemaExists(schemaId);
    const fields = await this.fieldRepo.findBySchemaId(schemaId);
    return fields.map(f => this.toFieldResponse(f));
  }

  /**
   * Create a field definition under a schema.
   * @param schemaId - Schema ID
   * @param dto - Field definition data
   * @returns Created field definition
   */
  @Post(':id/fields')
  @ApiOperation({ summary: 'Create a field definition' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 201, type: FieldDefinitionResponseDto })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  async createField(
    @Param('id') schemaId: string,
    @Body() dto: CreateFieldDefinitionDto,
  ): Promise<FieldDefinitionResponseDto> {
    await this.ensureSchemaExists(schemaId);
    const field = FieldDefinition.create({
      schemaId,
      fieldName: dto.fieldName,
      displayName: dto.displayName,
      dataType: dto.dataType,
      isRequired: dto.isRequired,
      validationRules: dto.validationRules ?? null,
      extractionHint: dto.extractionHint ?? null,
      outputKey: dto.outputKey ?? null,
      sortOrder: dto.sortOrder,
    });
    await this.fieldRepo.save(field);
    return this.toFieldResponse(field);
  }

  /**
   * Update a field definition.
   * @param schemaId - Schema ID
   * @param fieldId - Field definition ID
   * @param dto - Update data
   * @returns Updated field definition
   */
  @Put(':id/fields/:fieldId')
  @ApiOperation({ summary: 'Update a field definition' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiParam({ name: 'fieldId', description: 'Field definition ID' })
  @ApiResponse({ status: 200, type: FieldDefinitionResponseDto })
  @ApiResponse({ status: 404, description: 'Schema or field not found' })
  async updateField(
    @Param('id') schemaId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDefinitionDto,
  ): Promise<FieldDefinitionResponseDto> {
    const field = await this.findField(schemaId, fieldId);
    field.update({
      displayName: dto.displayName,
      isRequired: dto.isRequired,
      validationRules: dto.validationRules,
      extractionHint: dto.extractionHint,
      outputKey: dto.outputKey,
      sortOrder: dto.sortOrder,
    });
    await this.fieldRepo.save(field);
    return this.toFieldResponse(field);
  }

  /**
   * Delete a field definition.
   * @param schemaId - Schema ID
   * @param fieldId - Field definition ID
   */
  @Delete(':id/fields/:fieldId')
  @ApiOperation({ summary: 'Delete a field definition' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiParam({ name: 'fieldId', description: 'Field definition ID' })
  @ApiResponse({ status: 200, description: 'Field deleted' })
  @ApiResponse({ status: 404, description: 'Schema or field not found' })
  async deleteField(
    @Param('id') schemaId: string,
    @Param('fieldId') fieldId: string,
  ): Promise<{ deleted: boolean }> {
    await this.findField(schemaId, fieldId);
    await this.fieldRepo.delete(fieldId);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════
  // Fingerprint Rule CRUD
  // ═══════════════════════════════════════════

  /**
   * List fingerprint rules for a schema.
   * @param schemaId - Schema ID
   * @returns Array of fingerprint rules
   */
  @Get(':id/fingerprint-rules')
  @ApiOperation({ summary: 'List fingerprint rules for a schema' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 200, type: [FingerprintRuleResponseDto] })
  async listRules(@Param('id') schemaId: string): Promise<FingerprintRuleResponseDto[]> {
    await this.ensureSchemaExists(schemaId);
    const rules = await this.ruleRepo.findBySchemaId(schemaId);
    return rules.map(r => this.toRuleResponse(r));
  }

  /**
   * Create a fingerprint rule under a schema.
   * @param schemaId - Schema ID
   * @param dto - Rule data
   * @returns Created fingerprint rule
   */
  @Post(':id/fingerprint-rules')
  @ApiOperation({ summary: 'Create a fingerprint rule' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 201, type: FingerprintRuleResponseDto })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  async createRule(
    @Param('id') schemaId: string,
    @Body() dto: CreateFingerprintRuleDto,
  ): Promise<FingerprintRuleResponseDto> {
    await this.ensureSchemaExists(schemaId);
    const rule = FingerprintRule.create({
      schemaId,
      ruleType: dto.ruleType,
      pattern: dto.pattern,
      priority: dto.priority,
    });
    await this.ruleRepo.save(rule);
    return this.toRuleResponse(rule);
  }

  /**
   * Update a fingerprint rule.
   * @param schemaId - Schema ID
   * @param ruleId - Rule ID
   * @param dto - Update data
   * @returns Updated fingerprint rule
   */
  @Put(':id/fingerprint-rules/:ruleId')
  @ApiOperation({ summary: 'Update a fingerprint rule' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiParam({ name: 'ruleId', description: 'Fingerprint rule ID' })
  @ApiResponse({ status: 200, type: FingerprintRuleResponseDto })
  @ApiResponse({ status: 404, description: 'Schema or rule not found' })
  async updateRule(
    @Param('id') schemaId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateFingerprintRuleDto,
  ): Promise<FingerprintRuleResponseDto> {
    const rule = await this.findRule(schemaId, ruleId);
    // Apply updates through domain methods
    if (dto.isActive === false) {
      rule.deactivate();
    } else if (dto.isActive === true) {
      rule.activate();
    }
    // For pattern/priority/ruleType we need to save via props manipulation
    // Since entity only has activate/deactivate, save updated props directly
    const props = rule.toProps();
    const updated = FingerprintRule.reconstitute({
      ...props,
      ruleType: dto.ruleType ? dto.ruleType as typeof props.ruleType : props.ruleType,
      pattern: dto.pattern ?? props.pattern,
      priority: dto.priority ?? props.priority,
      isActive: dto.isActive !== undefined ? dto.isActive : props.isActive,
    });
    await this.ruleRepo.save(updated);
    return this.toRuleResponse(updated);
  }

  /**
   * Delete a fingerprint rule.
   * @param schemaId - Schema ID
   * @param ruleId - Rule ID
   */
  @Delete(':id/fingerprint-rules/:ruleId')
  @ApiOperation({ summary: 'Delete a fingerprint rule' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiParam({ name: 'ruleId', description: 'Fingerprint rule ID' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  @ApiResponse({ status: 404, description: 'Schema or rule not found' })
  async deleteRule(
    @Param('id') schemaId: string,
    @Param('ruleId') ruleId: string,
  ): Promise<{ deleted: boolean }> {
    await this.findRule(schemaId, ruleId);
    await this.ruleRepo.delete(ruleId);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════
  // Schema Preview
  // ═══════════════════════════════════════════

  /**
   * Preview OCR extraction against a sample PDF using this schema's field list.
   * Does NOT create an Invoice or Batch — preview only.
   * @param schemaId - Schema ID
   * @param file - PDF file to extract from
   * @returns Extracted fields, raw text, and per-field confidence scores
   */
  @Post(':id/preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview schema extraction on a sample PDF (no Invoice created)' })
  @ApiParam({ name: 'id', description: 'Schema ID' })
  @ApiResponse({ status: 200, type: PreviewSchemaResponseDto })
  @ApiResponse({ status: 400, description: 'No file provided' })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  async previewExtraction(
    @Param('id') schemaId: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string } | undefined,
  ): Promise<PreviewSchemaResponseDto> {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    await this.ensureSchemaExists(schemaId);
    const result = await this.previewUseCase.execute({
      schemaId,
      fileContent: file.buffer,
    });
    return {
      schemaId: result.schemaId,
      schemaName: result.schemaName,
      extractedFields: result.extractedFields,
      rawText: result.rawText,
      fieldConfidences: result.fieldConfidences,
    };
  }

  // ═══════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════

  /**
   * Ensure schema exists, throw 404 if not.
   * @param schemaId - Schema ID to validate
   */
  private async ensureSchemaExists(schemaId: string): Promise<void> {
    const schema = await this.schemaRepo.findById(schemaId);
    if (!schema) {
      throw new NotFoundException(`Schema not found: ${schemaId}`);
    }
  }

  /**
   * Find a field definition belonging to a schema.
   * @param schemaId - Schema ID
   * @param fieldId - Field definition ID
   * @returns FieldDefinition entity
   */
  private async findField(schemaId: string, fieldId: string): Promise<FieldDefinition> {
    await this.ensureSchemaExists(schemaId);
    const fields = await this.fieldRepo.findBySchemaId(schemaId);
    const field = fields.find(f => f.id === fieldId);
    if (!field) {
      throw new NotFoundException(`Field definition not found: ${fieldId}`);
    }
    return field;
  }

  /**
   * Find a fingerprint rule belonging to a schema.
   * @param schemaId - Schema ID
   * @param ruleId - Rule ID
   * @returns FingerprintRule entity
   */
  private async findRule(schemaId: string, ruleId: string): Promise<FingerprintRule> {
    await this.ensureSchemaExists(schemaId);
    const rules = await this.ruleRepo.findBySchemaId(schemaId);
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) {
      throw new NotFoundException(`Fingerprint rule not found: ${ruleId}`);
    }
    return rule;
  }

  /**
   * Map FieldDefinition entity to response DTO.
   * @param f - FieldDefinition entity
   * @returns FieldDefinitionResponseDto
   */
  private toFieldResponse(f: FieldDefinition): FieldDefinitionResponseDto {
    return {
      id: f.id,
      schemaId: f.schemaId,
      fieldName: f.fieldName,
      displayName: f.displayName,
      dataType: f.dataType,
      isRequired: f.isRequired,
      validationRules: f.validationRules,
      extractionHint: f.extractionHint,
      outputKey: f.outputKey,
      sortOrder: f.sortOrder,
    };
  }

  /**
   * Map FingerprintRule entity to response DTO.
   * @param r - FingerprintRule entity
   * @returns FingerprintRuleResponseDto
   */
  private toRuleResponse(r: FingerprintRule): FingerprintRuleResponseDto {
    return {
      id: r.id,
      schemaId: r.schemaId,
      ruleType: r.ruleType,
      pattern: r.pattern,
      priority: r.priority,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
