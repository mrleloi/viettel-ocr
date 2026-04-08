import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IBatchRepository } from '../../domain/batch/batch.repository';
import type { ISchemaRepository } from '../../domain/schema/schema.repository';
import type { IFingerprintRuleRepository } from '../../domain/schema/fingerprint-rule.repository';
import type { IFieldDefinitionRepository } from '../../domain/schema/field-definition.repository';
import type { IOcrService, OcrExtractionResult } from '../../domain/processing/ocr.service';
import type { IFileStorage } from '../../domain/shared/file-storage';
import { ProcessingTrace } from '../../domain/processing/processing-trace.entity';
import type { IProcessingTraceRepository } from '../../domain/processing/processing-trace.repository';
import { FingerprintService } from '../../domain/schema/fingerprint.service';
import type { FingerprintRuleData } from '../../domain/schema/fingerprint.service';
import { PromptBuilder } from '../../domain/schema/prompt-builder.service';
import type { SchemaData, FieldData } from '../../domain/schema/prompt-builder.service';
import { ValidatorService } from '../../domain/processing/validator.service';
import type { ExtractedInvoiceData } from '../../domain/processing/validator.service';
import { ConfidenceCalculator } from '../../domain/processing/confidence-calculator.service';
import type { ConfidenceInput } from '../../domain/processing/confidence-calculator.service';
import type { Invoice, ExtractedDataProps } from '../../domain/invoice/invoice.entity';
import type { ClassificationMethod } from '@invoice-tool/shared';
import { CreateNotificationUseCase } from '../notification/create-notification.use-case';
import { CreateSchemaUseCase } from '../schema/create-schema.use-case';

/** Input for the processing use case */
export interface ProcessInvoiceInput {
  /** Invoice ID to process */
  readonly invoiceId: string;
}

/** Result of a single pipeline stage */
export interface StageResult {
  /** Stage name */
  readonly stage: string;
  /** Stage execution status */
  readonly status: 'completed' | 'failed' | 'skipped';
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Error message if failed */
  readonly error?: string;
}

/** Output of the processing use case */
export interface ProcessInvoiceOutput {
  /** Invoice ID */
  readonly invoiceId: string;
  /** Final invoice status */
  readonly finalStatus: string;
  /** Overall confidence score */
  readonly overallConfidence: number | null;
  /** Results of each pipeline stage */
  readonly stages: ReadonlyArray<StageResult>;
}

/** Default confidence thresholds for routing */
const DEFAULT_AUTO_APPROVE_THRESHOLD = 0.85;

/**
 * ProcessInvoiceUseCase — orchestrates the full invoice processing pipeline.
 *
 * Pipeline stages:
 * 1. Classify — fingerprint rules then LLM fallback
 * 2. Extract — build prompt, call OCR/AI service
 * 3. Validate — check business rules
 * 4. Score — compute confidence
 * 5. Maybe-create-schema — auto-create draft schema or emit suggestion
 * 6. Route — auto-approve or send to review
 */
@Injectable()
export class ProcessInvoiceUseCase {
  private readonly logger = new Logger(ProcessInvoiceUseCase.name);
  private readonly fingerprintService = new FingerprintService();
  private readonly promptBuilder = new PromptBuilder();
  private readonly validator = new ValidatorService();
  private readonly confidenceCalculator = new ConfidenceCalculator();

  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IBatchRepository') private readonly batchRepo: IBatchRepository,
    @Inject('ISchemaRepository') private readonly schemaRepo: ISchemaRepository,
    @Inject('IFingerprintRuleRepository') private readonly ruleRepo: IFingerprintRuleRepository,
    @Inject('IFieldDefinitionRepository') private readonly fieldDefRepo: IFieldDefinitionRepository,
    @Inject('IOcrService') private readonly ocrService: IOcrService,
    @Inject('IFileStorage') private readonly fileStorage: IFileStorage,
    @Optional() private readonly createNotification?: CreateNotificationUseCase,
    @Optional() @Inject('IProcessingTraceRepository') private readonly traceRepo?: IProcessingTraceRepository,
    @Optional() private readonly createSchemaUseCase?: CreateSchemaUseCase,
  ) {}

  /**
   * Execute the full processing pipeline for an invoice.
   * @param input - Invoice ID
   * @returns Processing result with stage details
   */
  async execute(input: ProcessInvoiceInput): Promise<ProcessInvoiceOutput> {
    const stages: StageResult[] = [];

    // Load invoice
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${input.invoiceId}`);
    }

    // Mark as processing
    invoice.markAsProcessing();
    await this.invoiceRepo.save(invoice);

    // Load batch for hint info
    const batch = await this.batchRepo.findById(invoice.batchId);

    let classificationMethod: ClassificationMethod = 'fingerprint';
    let classificationConfidence = 0;
    let matchedSchemaId: string | null = null;
    let fingerprintScore = 0;
    let ocrResult: OcrExtractionResult | null = null;

    // ============ STAGE 1: CLASSIFY ============
    try {
      const stageStart = Date.now();

      // Read PDF for OCR text (used in fingerprint)
      const pdfBase64 = await this.fileStorage.readFileAsBase64(invoice.storagePath);

      // Check if batch has hint schema
      if (batch?.hintSchemaId) {
        matchedSchemaId = batch.hintSchemaId;
        classificationMethod = 'frontend_hint' as ClassificationMethod;
        classificationConfidence = 0.7; // hint-only confidence
      }

      // Try fingerprint classification
      const rules = await this.ruleRepo.findAllActive();
      if (rules.length > 0) {
        const ruleData: FingerprintRuleData[] = rules.map(r => ({
          id: r.id,
          schemaId: r.schemaId,
          ruleType: this.mapRuleType(r.ruleType),
          ruleField: 'full_text' as const,
          ruleValue: r.pattern,
          priority: r.priority,
        }));

        const fpResult = this.fingerprintService.classify(
          { ocrText: pdfBase64 }, // Simplified: in real impl, would do OCR first
          ruleData,
        );

        if (fpResult.matched && fpResult.schemaId) {
          matchedSchemaId = fpResult.schemaId;
          classificationMethod = 'fingerprint';
          classificationConfidence = fpResult.score;
          fingerprintScore = fpResult.score;
        }
      }

      // Fallback to LLM classification if no match
      if (!matchedSchemaId) {
        const activeSchemas = await this.schemaRepo.findActive();
        if (activeSchemas.length > 0) {
          ocrResult = await this.ocrService.extractAndClassify(
            pdfBase64,
            activeSchemas.map(s => ({
              name: s.name,
              description: s.description ?? '',
              nccTaxId: s.nccTaxId,
            })),
          );

          if (ocrResult.classification) {
            // Find matching schema by name
            const matched = activeSchemas.find(
              s => s.name === ocrResult!.classification!.schemaName,
            );
            if (matched) {
              matchedSchemaId = matched.id;
              classificationMethod = 'llm' as ClassificationMethod;
              classificationConfidence = ocrResult.classification.confidence;
            }
          }
        }
      }

      const classifyDuration = Date.now() - stageStart;
      stages.push({ stage: 'classify', status: 'completed', durationMs: classifyDuration });
      await this.persistTrace(invoice.id, 'classify', 'completed', classifyDuration);
    } catch (error) {
      const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
      this.logger.error(`[classify] failed for invoice ${invoice.id}: ${msg}`);
      const errMsg = error instanceof Error ? error.message : String(error);
      stages.push({ stage: 'classify', status: 'failed', durationMs: 0, error: errMsg });
      await this.persistTrace(invoice.id, 'classify', 'failed', 0, errMsg);
      return this.failInvoice(invoice, stages);
    }

    // ============ STAGE 2: EXTRACT ============
    try {
      const stageStart = Date.now();

      if (!ocrResult) {
        const pdfBase64 = await this.fileStorage.readFileAsBase64(invoice.storagePath);

        if (matchedSchemaId) {
          const schema = await this.schemaRepo.findById(matchedSchemaId);
          const fields = await this.fieldDefRepo.findBySchemaId(matchedSchemaId);

          if (schema) {
            const schemaData: SchemaData = {
              id: schema.id,
              name: schema.name,
              description: schema.description,
              nccName: schema.nccName,
              nccTaxId: schema.nccTaxId,
              promptTemplate: schema.promptTemplate,
            };

            const fieldData: FieldData[] = fields.map(f => ({
              fieldName: f.fieldName,
              displayName: f.displayName,
              dataType: f.dataType as FieldData['dataType'],
              isRequired: f.isRequired,
              extractionHint: f.extractionHint,
            }));

            const prompt = this.promptBuilder.buildKnownSchemaPrompt(schemaData, fieldData);
            ocrResult = await this.ocrService.extract(pdfBase64, prompt.extractionPrompt);
          } else {
            ocrResult = await this.ocrService.extract(pdfBase64, 'Extract invoice data. Return JSON.');
          }
        } else {
          ocrResult = await this.ocrService.extract(pdfBase64, 'Extract invoice data. Return JSON.');
        }
      }

      // Set extracted data on invoice
      const extracted = this.mapOcrToExtractedData(
        ocrResult,
        matchedSchemaId,
        classificationMethod,
        classificationConfidence,
      );
      invoice.setExtractedData(extracted);
      await this.invoiceRepo.save(invoice);

      const extractDuration = Date.now() - stageStart;
      stages.push({ stage: 'extract', status: 'completed', durationMs: extractDuration });
      await this.persistTrace(invoice.id, 'extract', 'completed', extractDuration);
    } catch (error) {
      const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
      this.logger.error(`[extract] failed for invoice ${invoice.id}: ${msg}`);
      const extractErr = error instanceof Error ? error.message : String(error);
      stages.push({ stage: 'extract', status: 'failed', durationMs: 0, error: extractErr });
      await this.persistTrace(invoice.id, 'extract', 'failed', 0, extractErr);
      return this.failInvoice(invoice, stages);
    }

    // ============ STAGE 3: VALIDATE ============
    let validationPassRate = 0;
    try {
      const stageStart = Date.now();

      const validationData: ExtractedInvoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        invoiceSymbol: invoice.invoiceSymbol,
        invoiceDate: invoice.invoiceDate,
        sellerTaxId: invoice.sellerTaxId,
        buyerTaxId: invoice.buyerTaxId,
        subtotal: invoice.subtotal,
        vatRate: invoice.vatRate,
        vatAmount: invoice.vatAmount,
        total: invoice.total,
        lineItems: invoice.lineItems.map(li => ({
          name: li.name ?? null,
          quantity: li.quantity ?? null,
          unitPrice: li.unitPrice ?? null,
          amount: li.amount ?? null,
        })),
      };

      const validationResult = this.validator.validate(validationData);
      validationPassRate = validationResult.passRate;

      if (!validationResult.valid) {
        invoice.setValidationErrors(JSON.stringify({
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }));
      }

      invoice.markAsValidated();
      await this.invoiceRepo.save(invoice);

      const validateDuration = Date.now() - stageStart;
      stages.push({ stage: 'validate', status: 'completed', durationMs: validateDuration });
      await this.persistTrace(invoice.id, 'validate', 'completed', validateDuration);
    } catch (error) {
      const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
      this.logger.error(`[validate] failed for invoice ${invoice.id}: ${msg}`);
      const validateErr = error instanceof Error ? error.message : String(error);
      stages.push({ stage: 'validate', status: 'failed', durationMs: 0, error: validateErr });
      await this.persistTrace(invoice.id, 'validate', 'failed', 0, validateErr);
      return this.failInvoice(invoice, stages);
    }

    // ============ STAGE 4: SCORE ============
    let overallConfidence = 0;
    try {
      const stageStart = Date.now();

      const fieldConfidences: Record<string, number> = invoice.fieldConfidences
        ? JSON.parse(invoice.fieldConfidences)
        : {};

      // Get required fields from schema
      const requiredFields: string[] = [];
      if (matchedSchemaId) {
        const fields = await this.fieldDefRepo.findBySchemaId(matchedSchemaId);
        requiredFields.push(...fields.filter(f => f.isRequired).map(f => f.fieldName));
      }

      const confidenceInput: ConfidenceInput = {
        classificationMethod: (classificationMethod as ConfidenceInput['classificationMethod']) ?? 'llm',
        fingerprintScore,
        fieldConfidences,
        requiredFields,
        validationPassRate,
        mappingCompleteness: 0, // No mapping stage in this session
        hintMatchesFingerprint: batch?.hintSchemaId === matchedSchemaId && !!batch?.hintSchemaId,
        hasHint: !!batch?.hintSchemaId,
      };

      const confidenceResult = this.confidenceCalculator.calculate(confidenceInput);
      overallConfidence = confidenceResult.overallScore;

      invoice.setOverallConfidence(overallConfidence);
      await this.invoiceRepo.save(invoice);

      const scoreDuration = Date.now() - stageStart;
      stages.push({ stage: 'score', status: 'completed', durationMs: scoreDuration });
      await this.persistTrace(invoice.id, 'score', 'completed', scoreDuration);
    } catch (error) {
      const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
      this.logger.error(`[score] failed for invoice ${invoice.id}: ${msg}`);
      const scoreErr = error instanceof Error ? error.message : String(error);
      stages.push({ stage: 'score', status: 'failed', durationMs: 0, error: scoreErr });
      await this.persistTrace(invoice.id, 'score', 'failed', 0, scoreErr);
      return this.failInvoice(invoice, stages);
    }

    // Emit low-confidence notification if confidence < 60%
    const LOW_CONFIDENCE_THRESHOLD = 0.60;
    if (overallConfidence < LOW_CONFIDENCE_THRESHOLD) {
      try {
        await this.createNotification?.execute({
          category: 'low_confidence',
          title: 'Độ tin cậy thấp',
          message: `Hóa đơn ${invoice.invoiceNumber ?? invoice.id} có độ tin cậy ${(overallConfidence * 100).toFixed(0)}%, cần kiểm tra thủ công.`,
          relatedEntityType: 'invoice',
          relatedEntityId: invoice.id,
        });
      } catch (err) {
        this.logger.warn('Failed to create low-confidence notification', err);
      }
    }

    // ============ STAGE 5: MAYBE CREATE SCHEMA ============
    try {
      const stageStart = Date.now();

      if (!matchedSchemaId) {
        // No schema matched — check auto-create flag
        if (batch?.autoCreateSchemaOnNewPattern) {
          // Auto-create a draft schema from extracted data
          try {
            const sellerName = invoice.sellerName ?? 'Unknown';
            const sellerTaxId = invoice.sellerTaxId ?? `auto-${Date.now()}`;
            const schemaResult = await this.createSchemaUseCase?.execute({
              name: `Auto: ${sellerName} (${new Date().toISOString().slice(0, 10)})`,
              nccName: sellerName,
              nccTaxId: sellerTaxId,
              description: `Tự động tạo từ hóa đơn ${invoice.id}`,
            });
            if (schemaResult) {
              matchedSchemaId = schemaResult.schemaId;
              this.logger.log(`[maybe-create-schema] Auto-created draft schema ${schemaResult.schemaId} for invoice ${invoice.id}`);
            }
          } catch (createErr) {
            // Schema creation failed (e.g. duplicate taxId) — log warning, continue pipeline
            this.logger.warn(`[maybe-create-schema] Failed to auto-create schema for invoice ${invoice.id}`, createErr);
          }
        } else {
          // Emit schema_suggestion notification
          try {
            await this.createNotification?.execute({
              category: 'schema_suggestion',
              title: 'Phát hiện mẫu hóa đơn mới',
              message: `Hóa đơn ${invoice.invoiceNumber ?? invoice.id} không khớp mẫu nào. Vui lòng tạo mẫu mới.`,
              relatedEntityType: 'invoice',
              relatedEntityId: invoice.id,
            });
          } catch {
            this.logger.warn(`[maybe-create-schema] Failed to emit schema_suggestion notification`);
          }
        }
        stages.push({ stage: 'maybe_create_schema', status: 'completed', durationMs: Date.now() - stageStart });
        await this.persistTrace(invoice.id, 'maybe_create_schema', 'completed', Date.now() - stageStart);
      } else {
        // Schema already matched — skip
        stages.push({ stage: 'maybe_create_schema', status: 'skipped', durationMs: 0 });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[maybe-create-schema] failed for invoice ${invoice.id}: ${msg}`);
      stages.push({ stage: 'maybe_create_schema', status: 'failed', durationMs: 0, error: msg });
      // Don't fail the whole pipeline for this stage — continue to route
    }

    // ============ STAGE 6: ROUTE ============
    try {
      const stageStart = Date.now();

      if (overallConfidence >= DEFAULT_AUTO_APPROVE_THRESHOLD) {
        // Auto-approve: high confidence
        invoice.markAsMapped(); // Skipping mapping stage for now
      } else {
        // Needs review
        invoice.markAsNeedsReview();
      }
      await this.invoiceRepo.save(invoice);

      // Update batch counters
      if (batch) {
        batch.recordFileResult(true);
        await this.batchRepo.save(batch);
      }

      const routeDuration = Date.now() - stageStart;
      stages.push({ stage: 'route', status: 'completed', durationMs: routeDuration });
      await this.persistTrace(invoice.id, 'route', 'completed', routeDuration);
    } catch (error) {
      const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
      this.logger.error(`[route] failed for invoice ${invoice.id}: ${msg}`);
      const routeErr = error instanceof Error ? error.message : String(error);
      stages.push({ stage: 'route', status: 'failed', durationMs: 0, error: routeErr });
      await this.persistTrace(invoice.id, 'route', 'failed', 0, routeErr);
      return this.failInvoice(invoice, stages);
    }

    return {
      invoiceId: invoice.id,
      finalStatus: invoice.status,
      overallConfidence,
      stages,
    };
  }

  /**
   * Handle invoice failure at any stage.
   * @param invoice - Invoice entity
   * @param stages - Stage results collected so far
   * @returns ProcessInvoiceOutput with error status
   */
  private async failInvoice(
    invoice: Invoice,
    stages: StageResult[],
  ): Promise<ProcessInvoiceOutput> {
    try {
      invoice.markAsError();
      await this.invoiceRepo.save(invoice);

      // Update batch counters with failure
      const batch = await this.batchRepo.findById(invoice.batchId);
      if (batch) {
        batch.recordFileResult(false);
        await this.batchRepo.save(batch);
      }

      // Emit processing error notification
      try {
        await this.createNotification?.execute({
          category: 'processing_error',
          title: 'Lỗi xử lý hóa đơn',
          message: `Hóa đơn ${invoice.originalFilename} gặp lỗi trong quá trình xử lý.`,
          relatedEntityType: 'invoice',
          relatedEntityId: invoice.id,
        });
      } catch {
        // Best-effort notification
      }
    } catch {
      // Best-effort error recording
    }

    return {
      invoiceId: invoice.id,
      finalStatus: 'error',
      overallConfidence: null,
      stages,
    };
  }

  /**
   * Map OCR extraction result to ExtractedDataProps for the invoice entity.
   * @param ocrResult - OCR extraction result
   * @param schemaId - Matched schema ID
   * @param method - Classification method
   * @param confidence - Classification confidence
   * @returns ExtractedDataProps
   */
  private mapOcrToExtractedData(
    ocrResult: OcrExtractionResult,
    schemaId: string | null,
    method: ClassificationMethod,
    confidence: number,
  ): ExtractedDataProps {
    const fields = ocrResult.extractedData as Record<string, { value: unknown; confidence?: number }>;
    const getField = (name: string): string | null => {
      const val = fields[name]?.value ?? (ocrResult.extractedData[name] as unknown);
      return val != null ? String(val) : null;
    };
    const getNumField = (name: string): number | null => {
      const val = fields[name]?.value ?? (ocrResult.extractedData[name] as unknown);
      return val != null ? Number(val) : null;
    };

    return {
      schemaId: schemaId,
      classificationMethod: method,
      classificationConfidence: confidence,
      invoiceNumber: getField('invoice_number'),
      invoiceSymbol: getField('invoice_symbol'),
      invoiceDate: getField('invoice_date'),
      invoiceType: null,
      sellerName: getField('seller_name'),
      sellerTaxId: getField('seller_tax_id'),
      buyerName: getField('buyer_name'),
      buyerTaxId: getField('buyer_tax_id'),
      subtotal: getNumField('subtotal'),
      vatRate: getNumField('vat_rate'),
      vatAmount: getNumField('vat_amount'),
      total: getNumField('total'),
      poNumber: getField('po_number'),
      lineItems: Array.isArray(ocrResult.extractedData['line_items'])
        ? (ocrResult.extractedData['line_items'] as Array<Record<string, unknown>>).map(li => ({
            name: li['name'] ? String(li['name']) : '',
            unit: li['unit'] ? String(li['unit']) : null,
            quantity: li['quantity'] != null ? Number(li['quantity']) : 0,
            unitPrice: li['unit_price'] != null ? Number(li['unit_price']) : 0,
            amount: li['amount'] != null ? Number(li['amount']) : 0,
            vatRate: li['vat_rate'] != null ? Number(li['vat_rate']) : null,
            vatAmount: li['vat_amount'] != null ? Number(li['vat_amount']) : null,
            totalWithVat: li['total_with_vat'] != null ? Number(li['total_with_vat']) : null,
          }))
        : [],
      ocrRawText: ocrResult.rawText,
      extractedRawJson: JSON.stringify(ocrResult.extractedData),
      fieldConfidences: Object.keys(ocrResult.fieldConfidences).length > 0
        ? JSON.stringify(ocrResult.fieldConfidences)
        : null,
    };
  }

  /**
   * Map entity rule type to FingerprintRuleData format.
   * @param ruleType - Entity rule type string
   * @returns Mapped rule type for FingerprintService
   */
  private mapRuleType(ruleType: string): FingerprintRuleData['ruleType'] {
    const mapping: Record<string, FingerprintRuleData['ruleType']> = {
      mst_exact: 'mst_exact',
      keyword: 'keyword_contains',
      symbol_regex: 'symbol_regex',
      custom: 'custom_regex',
    };
    return mapping[ruleType] ?? 'custom_regex';
  }

  /**
   * Persist a processing trace record (best-effort, won't break pipeline on failure).
   * @param invoiceId - Invoice ID
   * @param stage - Pipeline stage name
   * @param status - Stage execution status
   * @param durationMs - Stage duration in milliseconds
   * @param errorMessage - Optional error message
   */
  private async persistTrace(
    invoiceId: string,
    stage: string,
    status: string,
    durationMs: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      if (this.traceRepo) {
        const trace = ProcessingTrace.create({
          invoiceId,
          stage,
          status,
          durationMs,
          errorMessage: errorMessage ?? null,
        });
        await this.traceRepo.save(trace);
      }
    } catch (err) {
      this.logger.warn(`Failed to persist trace for ${stage}`, err);
    }
  }
}
