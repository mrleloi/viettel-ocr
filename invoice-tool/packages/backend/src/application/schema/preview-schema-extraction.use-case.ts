import { Injectable, Inject } from '@nestjs/common';
import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import type { IFieldDefinitionRepository } from '../../domain/schema/field-definition.repository';
import type { IOcrService } from '../../domain/processing/ocr.service';
import { PromptBuilder } from '../../domain/schema/prompt-builder.service';
import { DomainError } from '../../domain/shared/domain-error';

/** Input for schema extraction preview */
export interface PreviewSchemaInput {
  /** Schema ID to use for extraction */
  readonly schemaId: string;
  /** PDF file content as binary buffer */
  readonly fileContent: Buffer;
}

/** Output of schema extraction preview */
export interface PreviewSchemaOutput {
  /** Schema ID used for extraction */
  readonly schemaId: string;
  /** Schema display name */
  readonly schemaName: string;
  /** Extracted field values from the PDF */
  readonly extractedFields: Record<string, unknown>;
  /** Raw OCR text from the PDF */
  readonly rawText: string;
  /** Per-field confidence scores (0.0-1.0) */
  readonly fieldConfidences: Record<string, number>;
}

/**
 * PreviewSchemaExtractionUseCase — runs OCR extraction using a schema's field list
 * against a sample PDF, returning the result without creating an Invoice or Batch.
 *
 * Used by the schema wizard (session 23) to preview how a schema performs against
 * a real supplier PDF before activating it.
 */
@Injectable()
export class PreviewSchemaExtractionUseCase {
  private readonly promptBuilder = new PromptBuilder();

  constructor(
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
    @Inject('IFieldDefinitionRepository') private readonly fieldDefRepo: IFieldDefinitionRepository,
    @Inject('IOcrService') private readonly ocrService: IOcrService,
  ) {}

  /**
   * Run OCR extraction preview against a sample PDF.
   * @param input Schema ID and PDF file content
   * @returns Extracted fields, raw text, and per-field confidence scores
   * @throws DomainError if schema not found
   */
  async execute(input: PreviewSchemaInput): Promise<PreviewSchemaOutput> {
    const schema = await this.schemaRepo.findById(input.schemaId);
    if (!schema) {
      throw new DomainError(`Schema not found: ${input.schemaId}`);
    }

    const fieldDefs = await this.fieldDefRepo.findBySchemaId(input.schemaId);

    const { extractionPrompt } = this.promptBuilder.buildKnownSchemaPrompt(
      {
        id: schema.id,
        name: schema.name,
        description: schema.description,
        nccName: schema.nccName,
        nccTaxId: schema.nccTaxId,
        promptTemplate: schema.promptTemplate,
      },
      fieldDefs.map(f => ({
        fieldName: f.fieldName,
        displayName: f.displayName,
        dataType: f.dataType,
        isRequired: f.isRequired,
        extractionHint: f.extractionHint,
      })),
    );

    const pdfBase64 = input.fileContent.toString('base64');
    const result = await this.ocrService.extract(pdfBase64, extractionPrompt);

    return {
      schemaId: schema.id,
      schemaName: schema.name,
      extractedFields: result.extractedData,
      rawText: result.rawText,
      fieldConfidences: result.fieldConfidences,
    };
  }
}
