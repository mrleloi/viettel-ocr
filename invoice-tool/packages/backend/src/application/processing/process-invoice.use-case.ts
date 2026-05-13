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
import type { IMappingRepository } from '../../domain/mapping/mapping.repository';
import type { IProductRepository } from '../../domain/product/product.repository';
import { FuzzyMatcher } from '../../domain/mapping/fuzzy-matcher.service';
import type { ProductData } from '../../domain/mapping/fuzzy-matcher.service';
import { Mapping } from '../../domain/mapping/mapping.entity';

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
const DEFAULT_AUTO_APPROVE_THRESHOLD = 0.90;

/**
 * Fallback extraction prompt for invoices that don't match any known schema.
 *
 * Enforces:
 * - Snake_case field names matching the entity (no `total_amount`, `items`, etc.)
 * - Integer VND values (no Vietnamese thousands separators that would parse as decimals)
 * - ISO 8601 dates (YYYY-MM-DD)
 * - Confidence map keyed by the same field names
 *
 * Without this contract, Gemini freely picks names like `total_amount` / `total_tax_amount` / `items`
 * which the mapper cannot recognize, leaving lineItems/total/vatAmount null.
 */
const NO_SCHEMA_FALLBACK_PROMPT = `Trích xuất dữ liệu từ hóa đơn Việt Nam này. Trả về JSON với cấu trúc sau:

{
  "invoice_number": string | null,
  "invoice_symbol": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "seller_name": string | null,
  "seller_tax_id": string | null,
  "buyer_name": string | null,
  "buyer_tax_id": string | null,
  "subtotal": integer | null,
  "vat_rate": integer | null,
  "vat_amount": integer | null,
  "total": integer | null,
  "po_number": string | null,
  "line_items": [
    {
      "product_code": string | null,
      "name": string,
      "unit": string | null,
      "quantity": number,
      "unit_price": integer,
      "amount": integer,
      "vat_rate": integer | null,
      "vat_amount": integer | null,
      "total_with_vat": integer | null
    }
  ],
  "field_confidences": { "<field_name>": number /* 0..1 */ }
}

QUAN TRỌNG:
- Tất cả số tiền là số nguyên VND (không có dấu phân cách hàng nghìn, không có thập phân).
  Ví dụ: "881.900" trên hóa đơn = 881900 (KHÔNG phải 881.9).
- Cho phép số âm với hóa đơn điều chỉnh giảm (credit note).
- vat_rate là phần trăm số nguyên (8 nghĩa là 8%, không phải 0.08).

PHÂN BIỆT CỘT (rất quan trọng — đừng nhầm):
- "subtotal"   = cột "Thành tiền chưa thuế GTGT" / "Amount exclusive VAT" / "Cộng tiền hàng" (chưa VAT).
- "vat_amount" = cột "Tiền thuế GTGT" / "VAT Amount" (chỉ là tiền thuế, KHÔNG phải tiền hàng).
- "total"      = cột "Thành tiền" / "Tổng cộng tiền thanh toán" (đã có VAT).
- Kiểm tra: subtotal + vat_amount === total. Nếu không khớp, bạn đã đọc nhầm cột — đọc lại.
- Kiểm tra: subtotal === tổng các line_items.amount. Nếu không khớp, đọc lại line items.

LINE ITEMS:
- "product_code" lấy từ cột "Mã sản phẩm" / "Part no." (ví dụ "MXP63ZP/A"). Null nếu không có cột này.
- "amount" = quantity × unit_price (chưa VAT). Không lấy cột có VAT.

- Dùng ĐÚNG tên trường ở trên (snake_case). Không dùng "items", "total_amount", "total_tax_amount".
- Nếu không tìm thấy trường nào, trả về null kèm field_confidences[trường] = 0.
- Trả về CHÍNH XÁC JSON, không kèm văn bản giải thích.`;

/**
 * ProcessInvoiceUseCase — orchestrates the full invoice processing pipeline.
 *
 * Pipeline stages:
 * 1. Classify — fingerprint rules then LLM fallback
 * 2. Extract — build prompt, call OCR/AI service
 * 3. Map — field-level re-keying + product-line fuzzy matching
 * 4. Validate — check business rules
 * 5. Score — compute confidence
 * 6. Maybe-create-schema — auto-create draft schema or emit suggestion
 * 7. Route — auto-approve or send to review
 */
@Injectable()
export class ProcessInvoiceUseCase {
  private readonly logger = new Logger(ProcessInvoiceUseCase.name);
  private readonly fingerprintService = new FingerprintService();
  private readonly promptBuilder = new PromptBuilder();
  private readonly validator = new ValidatorService();
  private readonly confidenceCalculator = new ConfidenceCalculator();
  private readonly fuzzyMatcher = new FuzzyMatcher();
  /** Tracks the AI prompt used in the current extract stage (for trace logging) */
  private lastExtractPrompt: string | null = null;

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
    @Optional() @Inject('IMappingRepository') private readonly mappingRepo?: IMappingRepository,
    @Optional() @Inject('IProductRepository') private readonly productRepo?: IProductRepository,
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

    let classificationMethod: ClassificationMethod = 'llm';
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

      // Try fingerprint classification (only from active schemas)
      const allRules = await this.ruleRepo.findAllActive();
      // Filter: only include rules belonging to active schemas
      const activeSchemaIds = new Set(
        (await this.schemaRepo.findActive()).map(s => s.id),
      );
      const rules = allRules.filter(r => activeSchemaIds.has(r.schemaId));
      if (rules.length > 0) {
        const ruleData: FingerprintRuleData[] = rules.map(r => ({
          id: r.id,
          schemaId: r.schemaId,
          ruleType: this.mapRuleType(r.ruleType),
          ruleField: 'full_text' as const,
          ruleValue: r.pattern,
          priority: r.priority,
        }));

        // Pre-extraction fingerprint: no OCR text available yet, so this pass
        // only works for rules that don't need text (none currently).
        // Post-extraction fingerprint re-run (after stage 2) handles text-based rules.
        const fpResult = this.fingerprintService.classify(
          { ocrText: '' },
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
          try {
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
          } catch (llmErr) {
            // LLM classify failed (e.g. Gemini 503) — non-fatal, proceed to extract with fallback prompt
            const llmMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
            this.logger.warn(`[classify] LLM classification failed, will use fallback extraction: ${llmMsg}`);
          }
        }
      }

      const classifyDuration = Date.now() - stageStart;
      stages.push({ stage: 'classify', status: 'completed', durationMs: classifyDuration });
      await this.persistTrace(invoice.id, 'classify', 'completed', classifyDuration, undefined,
        JSON.stringify({ method: classificationMethod, confidence: classificationConfidence, schemaId: matchedSchemaId }),
        JSON.stringify({ matchedSchemaId, classificationMethod, classificationConfidence, fingerprintScore }),
      );
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
              outputKey: f.outputKey,
            }));

            const prompt = this.promptBuilder.buildKnownSchemaPrompt(schemaData, fieldData);
            this.lastExtractPrompt = prompt.extractionPrompt;
            ocrResult = await this.ocrService.extract(pdfBase64, prompt.extractionPrompt);
          } else {
            this.lastExtractPrompt = NO_SCHEMA_FALLBACK_PROMPT;
            ocrResult = await this.ocrService.extract(pdfBase64, NO_SCHEMA_FALLBACK_PROMPT);
          }
        } else {
          this.lastExtractPrompt = NO_SCHEMA_FALLBACK_PROMPT;
          ocrResult = await this.ocrService.extract(pdfBase64, NO_SCHEMA_FALLBACK_PROMPT);
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

      // Re-run fingerprint with actual extracted data if it was zero before
      if (fingerprintScore === 0) {
        const allRules = await this.ruleRepo.findAllActive();
        const activeSchemaIds = new Set(
          (await this.schemaRepo.findActive()).map(s => s.id),
        );
        const rules = allRules.filter(r => activeSchemaIds.has(r.schemaId));
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
            {
              ocrText: ocrResult.rawText ?? '',
              sellerTaxId: invoice.sellerTaxId ?? undefined,
              invoiceSymbol: invoice.invoiceSymbol ?? undefined,
            },
            ruleData,
          );

          if (fpResult.matched && fpResult.schemaId) {
            fingerprintScore = fpResult.score;
            classificationMethod = 'fingerprint';
            classificationConfidence = fpResult.score;

            // If fingerprint discovered or confirmed the schema, update it
            if (!matchedSchemaId || fpResult.schemaId === matchedSchemaId) {
              matchedSchemaId = fpResult.schemaId;
              // Persist the schema assignment back to the invoice
              invoice.assignSchema(matchedSchemaId);
              await this.invoiceRepo.save(invoice);
            }
            this.logger.log(
              `[extract] Post-extraction fingerprint matched schema ${fpResult.schemaId} with score ${fpResult.score}`,
            );
          }
        }
      }

      const extractDuration = Date.now() - stageStart;
      stages.push({ stage: 'extract', status: 'completed', durationMs: extractDuration });
      await this.persistTrace(invoice.id, 'extract', 'completed', extractDuration, undefined,
        JSON.stringify({ prompt: this.lastExtractPrompt?.slice(0, 2000) }),
        JSON.stringify({ fieldsExtracted: Object.keys(ocrResult?.extractedData ?? {}), hasLineItems: Array.isArray(ocrResult?.extractedData?.['line_items']), postExtractFingerprintScore: fingerprintScore }),
      );
    } catch (error) {
      const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
      this.logger.error(`[extract] failed for invoice ${invoice.id}: ${msg}`);
      const extractErr = error instanceof Error ? error.message : String(error);
      stages.push({ stage: 'extract', status: 'failed', durationMs: 0, error: extractErr });
      await this.persistTrace(invoice.id, 'extract', 'failed', 0, extractErr);
      return this.failInvoice(invoice, stages);
    }

    // ============ STAGE 3: MAP ============
    let mappingCompleteness = 0;
    try {
      const stageStart = Date.now();

      if (matchedSchemaId && this.mappingRepo && this.productRepo) {
        const lineItems = invoice.lineItems;
        if (lineItems.length > 0) {
          let mappedCount = 0;

          // Load all Viettel products for fuzzy matching
          const allProducts = await this.productRepo.findAll();
          const productData: ProductData[] = allProducts.map(p => ({
            id: p.id,
            productCode: p.productCode,
            productName: p.productName,
            brand: null,
          }));

          for (const li of lineItems) {
            if (!li.name) continue;

            // Step 1: Check existing mapping in the mapping table
            const existingMapping = await this.mappingRepo.findByPartnerName(
              li.name,
              matchedSchemaId,
            );

            if (existingMapping && existingMapping.status === 'active' && existingMapping.viettelProductId) {
              // Exact match found — increment usage
              await this.mappingRepo.incrementUsage(existingMapping.id);
              mappedCount++;
              continue;
            }

            // Step 2: Fuzzy match against Viettel product catalog
            if (productData.length > 0) {
              const matches = this.fuzzyMatcher.match(li.name, productData, {
                topN: 1,
                threshold: 0.7,
              });

              if (matches.length > 0) {
                const best = matches[0];
                // Auto-create a pending_review mapping for review
                try {
                  const newMapping = Mapping.create({
                    schemaId: matchedSchemaId,
                    partnerProductName: li.name,
                    viettelProductId: best.productId,
                    viettelProductCode: best.productCode,
                    viettelProductName: best.productName,
                    source: 'auto_learned',
                    confidence: best.score,
                  });
                  await this.mappingRepo.save(newMapping);
                  mappedCount++;
                } catch (mapErr) {
                  this.logger.warn(`[map] Failed to create auto mapping for "${li.name}"`, mapErr);
                }
              }
            }
          }

          // Don't penalize mapping when the catalog isn't configured for this vendor:
          // - No products in catalog at all, OR
          // - No existing confirmed mappings for this schema AND no fuzzy matches found
          if (mappedCount === 0) {
            const existingSchemaMappings = await this.mappingRepo.findBySchemaId(matchedSchemaId);
            const hasConfirmedMappings = existingSchemaMappings.some(m => m.status === 'active');
            if (!hasConfirmedMappings) {
              // No mapping configured for this vendor yet — don't penalize
              mappingCompleteness = 1.0;
            } else {
              mappingCompleteness = 0;
            }
          } else {
            mappingCompleteness = mappedCount / lineItems.length;
          }
        } else {
          // No line items to map — consider fully mapped
          mappingCompleteness = 1.0;
        }
      } else {
        // No schema or no mapping repo — skip mapping but don't penalize
        mappingCompleteness = 1.0;
        stages.push({ stage: 'map', status: 'skipped', durationMs: 0 });
      }

      if (!stages.find(s => s.stage === 'map')) {
        const mapDuration = Date.now() - stageStart;
        stages.push({ stage: 'map', status: 'completed', durationMs: mapDuration });
        await this.persistTrace(invoice.id, 'map', 'completed', mapDuration);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[map] failed for invoice ${invoice.id}: ${msg}`);
      stages.push({ stage: 'map', status: 'failed', durationMs: 0, error: msg });
      await this.persistTrace(invoice.id, 'map', 'failed', 0, msg);
      // Map stage failure is non-fatal — continue pipeline with mappingCompleteness = 0
    }

    // ============ STAGE 4: VALIDATE ============
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

      // Always store validation results so the frontend can display them
      invoice.setValidationErrors(JSON.stringify({
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      }));

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

    // ============ STAGE 5: SCORE ============
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
        mappingCompleteness,
        hintMatchesFingerprint: batch?.hintSchemaId === matchedSchemaId && !!batch?.hintSchemaId,
        hasHint: !!batch?.hintSchemaId,
        classificationConfidence,
      };

      const confidenceResult = this.confidenceCalculator.calculate(confidenceInput);
      overallConfidence = confidenceResult.overallScore;

      invoice.setOverallConfidence(overallConfidence);
      await this.invoiceRepo.save(invoice);

      const scoreDuration = Date.now() - stageStart;
      stages.push({ stage: 'score', status: 'completed', durationMs: scoreDuration });
      // Save full confidence breakdown to trace for frontend display
      await this.persistTrace(invoice.id, 'score', 'completed', scoreDuration, undefined,
        JSON.stringify(confidenceInput),
        JSON.stringify({
          overallScore: confidenceResult.overallScore,
          componentScores: confidenceResult.componentScores,
          penalties: confidenceResult.penalties,
          weights: { hint: 0.30, fingerprint: 0.25, extraction: 0.25, validation: 0.10, mapping: 0.10 },
        }),
      );
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

    // ============ STAGE 6: MAYBE CREATE SCHEMA ============
    try {
      const stageStart = Date.now();

      if (!matchedSchemaId) {
        // No schema matched — check auto-create flag
        if (batch?.autoCreateSchemaOnNewPattern) {
          // Auto-create schema WITH fingerprint rules + field definitions from extracted data
          try {
            const sellerName = invoice.sellerName ?? 'Unknown';
            const sellerTaxId = invoice.sellerTaxId ?? `auto-${Date.now()}`;

            // Build fingerprint rules from extracted data
            const autoRules: Array<{ ruleType: string; pattern: string; priority: number }> = [];
            if (invoice.sellerTaxId) {
              autoRules.push({ ruleType: 'mst_exact', pattern: invoice.sellerTaxId, priority: 100 });
            }
            if (invoice.sellerName) {
              autoRules.push({ ruleType: 'keyword', pattern: invoice.sellerName, priority: 50 });
            }

            // Build field definitions from extracted data keys
            const autoFields = this.detectFieldDefinitions(invoice);

            const schemaResult = await this.createSchemaUseCase?.execute({
              name: `${sellerName} (${new Date().toISOString().slice(0, 10)})`,
              nccName: sellerName,
              nccTaxId: sellerTaxId,
              description: `Tự động tạo từ hóa đơn ${invoice.id}`,
              fingerprintRules: autoRules,
              fieldDefinitions: autoFields,
            });

            if (schemaResult) {
              matchedSchemaId = schemaResult.schemaId;

              // Activate schema immediately so it participates in future classify
              const createdSchema = await this.schemaRepo.findById(schemaResult.schemaId);
              if (createdSchema) {
                createdSchema.activate();
                await this.schemaRepo.save(createdSchema);
              }

              // Assign the new schema back to this invoice
              invoice.assignSchema(matchedSchemaId);
              await this.invoiceRepo.save(invoice);

              this.logger.log(
                `[maybe-create-schema] Auto-created & activated schema ${schemaResult.schemaId} ` +
                `with ${autoRules.length} rules + ${autoFields.length} fields for invoice ${invoice.id}`,
              );
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

    // ============ STAGE 7: ROUTE ============
    try {
      const stageStart = Date.now();

      // Block auto-approve if validation produced any errors — high confidence on
      // garbage extraction (e.g. subtotal column-swap) must still go to human review.
      let hasValidationErrors = false;
      if (invoice.validationErrors) {
        try {
          const parsed = JSON.parse(invoice.validationErrors) as { errors?: unknown[] };
          hasValidationErrors = Array.isArray(parsed.errors) && parsed.errors.length > 0;
        } catch {
          // malformed JSON — treat as unsafe, route to review
          hasValidationErrors = true;
        }
      }

      if (overallConfidence >= DEFAULT_AUTO_APPROVE_THRESHOLD && !hasValidationErrors) {
        // Auto-approve: high confidence AND clean validation — skip review queue
        invoice.autoApprove();
        this.logger.log(
          `[route] Auto-approved invoice ${invoice.id} (confidence ${(overallConfidence * 100).toFixed(1)}%)`,
        );
      } else {
        // Needs review (low confidence OR validation errors)
        invoice.markAsNeedsReview();
        if (hasValidationErrors && overallConfidence >= DEFAULT_AUTO_APPROVE_THRESHOLD) {
          this.logger.log(
            `[route] Sent invoice ${invoice.id} to review (confidence ${(overallConfidence * 100).toFixed(1)}% but validation errors present)`,
          );
        }
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
   *
   * Defensive against LLM field-name drift: each canonical field has a list of
   * acceptable aliases (e.g. `total` ↔ `total_amount`, `line_items` ↔ `items`).
   * Numbers are parsed with Vietnamese-aware logic so `"881.900"` (thousands
   * separator) becomes 881900, not 881.9.
   *
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
    const data = ocrResult.extractedData;
    // Some schema prompts cause Gemini to nest fields under a "fields" envelope
    const fieldsEnvelope = (data['fields'] ?? data['data']) as Record<string, unknown> | undefined;

    /** Read a field value, accepting either `{value}` envelope or raw value, across alias keys. */
    const readRaw = (keys: readonly string[]): unknown => {
      for (const key of keys) {
        // Check top-level first
        const direct = data[key];
        if (direct !== undefined && direct !== null) {
          if (typeof direct === 'object' && 'value' in (direct as Record<string, unknown>)) {
            return (direct as { value: unknown }).value;
          }
          return direct;
        }
        // Check inside "fields" / "data" envelope
        if (fieldsEnvelope) {
          const nested = fieldsEnvelope[key];
          if (nested !== undefined && nested !== null) {
            if (typeof nested === 'object' && 'value' in (nested as Record<string, unknown>)) {
              return (nested as { value: unknown }).value;
            }
            return nested;
          }
        }
      }
      return null;
    };

    const getString = (keys: readonly string[]): string | null => {
      const val = readRaw(keys);
      return val != null ? String(val) : null;
    };

    const getNumber = (keys: readonly string[]): number | null => {
      const val = readRaw(keys);
      return val != null ? this.parseVietnameseNumber(val) : null;
    };

    const lineItemsRaw = readRaw(['line_items', 'items', 'lineItems']);
    // Invoice-level VAT rate (needed for per-item VAT fallback computation)
    const invoiceVatRate = this.normalizeVatRate(getNumber(['vat_rate', 'tax_rate', 'vatRate']));

    // Gemini may wrap each line-item field as { value, confidence }. Unwrap before reading.
    const unwrap = (v: unknown): unknown => {
      if (v != null && typeof v === 'object' && !Array.isArray(v) && 'value' in (v as Record<string, unknown>)) {
        return (v as { value: unknown }).value;
      }
      return v;
    };
    const pick = (li: Record<string, unknown>, keys: readonly string[]): unknown => {
      for (const k of keys) {
        const raw = li[k];
        if (raw !== undefined && raw !== null) return unwrap(raw);
      }
      return undefined;
    };

    const lineItems = Array.isArray(lineItemsRaw)
      ? (lineItemsRaw as Array<Record<string, unknown>>).map((li) => {
          const rawProductCode = pick(li, ['product_code', 'productCode', 'part_no', 'partNo', 'part_number', 'sku', 'item_code', 'itemCode']);
          const rawName = pick(li, ['name', 'item_name', 'item_description', 'description', 'product_name']);
          const rawUnit = pick(li, ['unit', 'item_unit']);
          const quantity = this.parseVietnameseNumber(pick(li, ['quantity', 'item_quantity'])) ?? 0;
          const unitPrice = this.parseVietnameseNumber(pick(li, ['unit_price', 'unitPrice', 'item_unit_price'])) ?? 0;
          const rawAmount = this.parseVietnameseNumber(
            pick(li, ['amount', 'line_total', 'lineTotal', 'item_subtotal', 'item_amount']),
          ) ?? 0;
          const itemVatRate = this.normalizeVatRate(this.parseVietnameseNumber(pick(li, ['vat_rate', 'tax_rate', 'vatRate', 'item_vat_rate', 'item_tax_rate'])));
          // Sanity-check: amount should equal quantity × unit_price (pre-VAT).
          // If the AI read the with-VAT column by mistake, amount will be ~10% higher.
          // Trust qty × unit_price when the discrepancy is > 1%.
          const expectedAmount = quantity * unitPrice;
          const amount = (Math.abs(expectedAmount) > 0 && Math.abs(rawAmount - expectedAmount) / Math.abs(expectedAmount) > 0.01)
            ? expectedAmount
            : rawAmount;
          const itemVatAmount = this.parseVietnameseNumber(
            pick(li, ['vat_amount', 'tax_amount', 'vatAmount', 'item_vat_amount', 'item_tax_amount']),
          );
          const itemTotalWithVat = this.parseVietnameseNumber(
            pick(li, ['total_with_vat', 'total_price', 'totalWithVat', 'item_total', 'item_total_with_vat']),
          );

          // Compute missing per-item VAT from invoice-level VAT rate
          const effectiveVatRate = itemVatRate ?? invoiceVatRate;
          const effectiveVatAmount = itemVatAmount ?? (effectiveVatRate != null && amount !== 0
            ? Math.round(amount * effectiveVatRate / 100)
            : null);
          const effectiveTotalWithVat = itemTotalWithVat ?? (effectiveVatAmount != null
            ? amount + effectiveVatAmount
            : null);

          const productCodeStr = rawProductCode != null ? String(rawProductCode).trim() : '';
          return {
            productCode: productCodeStr !== '' ? productCodeStr : null,
            name: rawName != null ? String(rawName) : '',
            unit: rawUnit != null ? String(rawUnit) : null,
            quantity,
            unitPrice,
            amount,
            vatRate: effectiveVatRate,
            vatAmount: effectiveVatAmount,
            totalWithVat: effectiveTotalWithVat,
          };
        })
      : [];

    let subtotal = getNumber(['subtotal', 'sub_total', 'pre_tax_total']);
    const vatRate = this.normalizeVatRate(getNumber(['vat_rate', 'tax_rate', 'vatRate']));
    let vatAmount = getNumber(['vat_amount', 'total_tax_amount', 'tax_amount', 'vatAmount']);
    let total = getNumber(['total', 'total_amount', 'grand_total', 'totalAmount']);

    // Self-heal header totals when line items are internally consistent but the
    // header is inconsistent with them. Common cause: multi-page invoices where
    // Gemini sums only the first page's line items into the header totals.
    if (lineItems.length > 0) {
      const allInternallyConsistent = lineItems.every((li) => {
        const expected = li.quantity * li.unitPrice;
        // Allow tiny FP/rounding drift (≤ 1 VND)
        return Math.abs(li.amount - expected) <= 1;
      });
      if (allInternallyConsistent) {
        const lineItemsSum = lineItems.reduce((s, li) => s + li.amount, 0);
        const lineVatSum = lineItems.reduce((s, li) => s + (li.vatAmount ?? 0), 0);
        const lineTotalSum = lineItems.reduce((s, li) => s + (li.totalWithVat ?? li.amount + (li.vatAmount ?? 0)), 0);
        // Threshold: > 1 VND mismatch between header subtotal and line items sum
        if (subtotal == null || Math.abs(subtotal - lineItemsSum) > 1) {
          this.logger.warn(`Header subtotal (${subtotal}) differs from line items sum (${lineItemsSum}); overriding from line items.`);
          subtotal = lineItemsSum;
          if (lineVatSum !== 0) vatAmount = lineVatSum;
          if (lineTotalSum !== 0) total = lineTotalSum;
        }
      }
    }

    return {
      schemaId: schemaId,
      classificationMethod: method,
      classificationConfidence: confidence,
      invoiceNumber: getString(['invoice_number', 'invoiceNumber']),
      invoiceSymbol: getString(['invoice_symbol', 'invoiceSymbol', 'symbol']),
      invoiceDate: getString(['invoice_date', 'invoiceDate', 'date']),
      invoiceType: null,
      sellerName: getString(['seller_name', 'sellerName']),
      sellerTaxId: getString(['seller_tax_id', 'sellerTaxId', 'seller_mst']),
      buyerName: getString(['buyer_name', 'buyerName']),
      buyerTaxId: getString(['buyer_tax_id', 'buyerTaxId', 'buyer_mst']),
      subtotal,
      vatRate,
      vatAmount,
      total,
      poNumber: getString(['po_number', 'poNumber']),
      lineItems,
      ocrRawText: ocrResult.rawText,
      extractedRawJson: JSON.stringify(ocrResult.extractedData),
      fieldConfidences: this.extractFieldConfidences(ocrResult, fieldsEnvelope),
    };
  }

  /**
   * Extract field confidences from OCR result, handling both flat and envelope formats.
   * @param ocrResult - OCR extraction result
   * @param fieldsEnvelope - Optional "fields" envelope from AI response
   * @returns JSON string of field confidences, or null
   */
  private extractFieldConfidences(
    ocrResult: OcrExtractionResult,
    fieldsEnvelope: Record<string, unknown> | undefined,
  ): string | null {
    // First try the standard location (flat field_confidences / confidence key)
    if (Object.keys(ocrResult.fieldConfidences).length > 0) {
      return JSON.stringify(ocrResult.fieldConfidences);
    }

    // Extract from envelope format: {"fields": {"invoice_number": {"value": ..., "confidence": 0.95}}}
    if (fieldsEnvelope && typeof fieldsEnvelope === 'object') {
      const confidences: Record<string, number> = {};
      for (const [key, val] of Object.entries(fieldsEnvelope)) {
        if (val && typeof val === 'object' && 'confidence' in (val as Record<string, unknown>)) {
          const conf = (val as { confidence: unknown }).confidence;
          if (typeof conf === 'number') {
            confidences[key] = conf;
          }
        }
      }
      if (Object.keys(confidences).length > 0) {
        return JSON.stringify(confidences);
      }
    }

    return null;
  }

  /**
   * Normalize VAT rate: AI may return 0.1 (decimal) instead of 10 (integer %).
   * Vietnamese VAT rates are 0, 5, 8, or 10. If the value is between 0 and 1
   * exclusive, multiply by 100 to convert to integer percentage.
   * @param rate - Raw VAT rate
   * @returns Normalized integer percentage, or null
   */
  private normalizeVatRate(rate: number | null): number | null {
    if (rate === null) return null;
    if (rate > 0 && rate < 1) {
      return Math.round(rate * 100);
    }
    return rate;
  }

  /**
   * Parse a value as a number with Vietnamese-format awareness.
   *
   * Vietnamese invoices use `.` as thousands separator and `,` as decimal,
   * the opposite of US/JS conventions. A naive `Number("881.900")` returns
   * 881.9 instead of 881900. We assume any monetary value with three or more
   * digits after the last `.` is using thousands grouping.
   *
   * @param val - Raw value to parse
   * @returns Parsed number, or null if not parseable
   */
  private parseVietnameseNumber(val: unknown): number | null {
    if (val == null) return null;
    if (typeof val === 'number') return Number.isFinite(val) ? val : null;
    if (typeof val !== 'string') {
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    }

    const trimmed = val.trim();
    if (trimmed === '') return null;

    // Strip currency symbols, percent signs, and whitespace; keep digits, separators, sign
    const cleaned = trimmed.replace(/[^\d.,-]/g, '');
    if (cleaned === '' || cleaned === '-') return null;

    // Find the last separator (either `.` or `,`); whichever sits rightmost is
    // the decimal candidate, the others are thousands groupings.
    const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
    if (lastSep === -1) {
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }

    const afterLast = cleaned.length - lastSep - 1;
    let normalized: string;
    if (afterLast === 3) {
      // Exactly 3 digits after the last separator → thousands grouping (VND convention).
      // Covers "881.900", "881,900", "1.234.567", "1,234,567".
      normalized = cleaned.replace(/[.,]/g, '');
    } else {
      // Last separator is the decimal point — strip earlier separators, normalise to '.'.
      const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, '');
      const decPart = cleaned.slice(lastSep + 1);
      normalized = `${intPart}.${decPart}`;
    }

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
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
    inputData?: string,
    outputData?: string,
  ): Promise<void> {
    try {
      if (this.traceRepo) {
        const trace = ProcessingTrace.create({
          invoiceId,
          stage,
          status,
          durationMs,
          errorMessage: errorMessage ?? null,
          inputData: inputData ?? null,
          outputData: outputData ?? null,
        });
        await this.traceRepo.save(trace);
      }
    } catch (err) {
      this.logger.warn(`Failed to persist trace for ${stage}`, err);
    }
  }

  /**
   * Detect field definitions from extracted invoice data.
   * Maps known OCR field names to display names, data types, and required status.
   * @param invoice - Invoice with extracted data
   * @returns Array of field definition inputs for CreateSchemaUseCase
   */
  private detectFieldDefinitions(invoice: Invoice): Array<{
    fieldName: string;
    displayName: string;
    dataType: string;
    isRequired: boolean;
    extractionHint?: string;
  }> {
    /** Known field metadata for Vietnamese invoices */
    const FIELD_META: Record<string, { displayName: string; dataType: string; isRequired: boolean }> = {
      invoice_number: { displayName: 'Số hóa đơn', dataType: 'string', isRequired: true },
      invoice_symbol: { displayName: 'Ký hiệu', dataType: 'string', isRequired: true },
      invoice_date: { displayName: 'Ngày hóa đơn', dataType: 'date', isRequired: true },
      invoice_type: { displayName: 'Loại hóa đơn', dataType: 'string', isRequired: false },
      seller_name: { displayName: 'Tên NCC', dataType: 'string', isRequired: true },
      seller_tax_id: { displayName: 'MST NCC', dataType: 'string', isRequired: true },
      buyer_name: { displayName: 'Tên người mua', dataType: 'string', isRequired: false },
      buyer_tax_id: { displayName: 'MST người mua', dataType: 'string', isRequired: false },
      subtotal: { displayName: 'Tiền trước thuế', dataType: 'integer', isRequired: true },
      vat_rate: { displayName: 'Thuế suất (%)', dataType: 'number', isRequired: false },
      vat_amount: { displayName: 'Tiền thuế', dataType: 'integer', isRequired: false },
      total: { displayName: 'Tổng tiền', dataType: 'integer', isRequired: true },
      po_number: { displayName: 'Số PO', dataType: 'string', isRequired: false },
    };

    const fields: Array<{ fieldName: string; displayName: string; dataType: string; isRequired: boolean; extractionHint?: string }> = [];
    const props = invoice.toProps() as unknown as Record<string, unknown>;

    // Map snake_case OCR names to camelCase entity props
    const FIELD_TO_PROP: Record<string, string> = {
      invoice_number: 'invoiceNumber', invoice_symbol: 'invoiceSymbol',
      invoice_date: 'invoiceDate', invoice_type: 'invoiceType',
      seller_name: 'sellerName', seller_tax_id: 'sellerTaxId',
      buyer_name: 'buyerName', buyer_tax_id: 'buyerTaxId',
      vat_rate: 'vatRate', vat_amount: 'vatAmount',
      po_number: 'poNumber', subtotal: 'subtotal', total: 'total',
    };

    // Check each known field against extracted data
    for (const [fieldName, meta] of Object.entries(FIELD_META)) {
      const propName = FIELD_TO_PROP[fieldName] ?? fieldName;
      const value = props[propName];

      if (value !== null && value !== undefined) {
        fields.push({
          fieldName,
          displayName: meta.displayName,
          dataType: meta.dataType,
          isRequired: meta.isRequired,
          extractionHint: `Detected from first invoice: ${String(value).slice(0, 50)}`,
        });
      }
    }

    // Ensure at minimum we have the core fields even if extraction missed them
    const existingNames = new Set(fields.map(f => f.fieldName));
    for (const coreName of ['invoice_number', 'seller_tax_id', 'total']) {
      if (!existingNames.has(coreName)) {
        const meta = FIELD_META[coreName];
        fields.push({
          fieldName: coreName,
          displayName: meta.displayName,
          dataType: meta.dataType,
          isRequired: meta.isRequired,
        });
      }
    }

    return fields;
  }
}
