import { Injectable } from '@nestjs/common';
import {
  IOcrService,
  OcrExtractionResult,
  SchemaInfo,
} from '../../domain/processing/ocr.service';
import { EnvConfigService } from '../config/env-config.service';

/**
 * Gemini Flash API client implementing the IOcrService domain port.
 *
 * Provides OCR extraction and classification capabilities using Google's
 * Gemini 2.0 Flash model. Includes retry logic with exponential backoff.
 */
@Injectable()
export class GeminiClient implements IOcrService {
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  private readonly baseDelay: number;

  constructor(
    private readonly config: EnvConfigService,
  ) {
    this.baseDelay = 1000;
  }

  /**
   * Create an instance for testing with configurable base delay.
   * @param config - Config service mock
   * @param baseDelay - Base delay in ms for retries (0 for instant test execution)
   * @returns GeminiClient instance
   */
  static createForTesting(
    config: Pick<EnvConfigService, 'geminiApiKey' | 'apiRetryCount'>,
    baseDelay: number,
  ): GeminiClient {
    const instance = Object.create(GeminiClient.prototype) as GeminiClient;
    Object.defineProperty(instance, 'config', { value: config });
    Object.defineProperty(instance, 'apiUrl', {
      value: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    });
    Object.defineProperty(instance, 'baseDelay', { value: baseDelay });
    return instance;
  }

  /**
   * Extract structured data from a PDF using a known schema prompt.
   * @param pdfBase64 - Base64-encoded PDF file
   * @param promptTemplate - Schema-specific extraction prompt
   * @returns Extraction result with structured data and confidence scores
   */
  async extract(pdfBase64: string, promptTemplate: string): Promise<OcrExtractionResult> {
    const body = this.buildRequestBody(pdfBase64, promptTemplate);
    return this.callWithRetry(body);
  }

  /**
   * Extract and classify a PDF against known schemas.
   * @param pdfBase64 - Base64-encoded PDF file
   * @param schemaList - List of known schemas for classification
   * @returns Extraction result with classification info
   */
  async extractAndClassify(
    pdfBase64: string,
    schemaList: SchemaInfo[],
  ): Promise<OcrExtractionResult> {
    const classificationPrompt = this.buildClassificationPrompt(schemaList);
    const body = this.buildRequestBody(pdfBase64, classificationPrompt);
    const rawResult = await this.callWithRetry(body);

    return this.parseClassificationResult(rawResult);
  }

  /**
   * Build the Gemini API request body.
   * @param pdfBase64 - Base64-encoded PDF
   * @param prompt - Text prompt
   * @returns API request body object
   */
  private buildRequestBody(pdfBase64: string, prompt: string): object {
    return {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    };
  }

  /**
   * Build a classification + extraction prompt for unknown schema mode.
   * @param schemaList - Known schemas for classification
   * @returns Combined classification + extraction prompt
   */
  private buildClassificationPrompt(schemaList: SchemaInfo[]): string {
    const schemaLines = schemaList
      .map((s) => `- "${s.name}": ${s.description} (MST: ${s.nccTaxId})`)
      .join('\n');

    return `First, classify this invoice. Known types:
${schemaLines}

Return JSON with:
- classification: {schema_name: string, confidence: number, reason: string}
- extracted_data: standard invoice fields (invoice_number, invoice_symbol, invoice_date, seller_name, seller_tax_id, buyer_name, buyer_tax_id, subtotal, vat_rate, vat_amount, total, line_items)
- field_confidences: per-field confidence scores (0.0-1.0)

All monetary values as integers (VND). Dates as YYYY-MM-DD. If field not found, set null with confidence 0.`;
  }

  /**
   * Call the Gemini API with exponential backoff retry.
   * @param body - Request body
   * @returns Parsed extraction result
   * @throws Error after max retries or on client errors
   */
  private async callWithRetry(body: object): Promise<OcrExtractionResult> {
    const maxRetries = this.config.apiRetryCount;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(
        `${this.apiUrl}?key=${this.config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        const json = (await response.json()) as {
          candidates: Array<{
            content: { parts: Array<{ text: string }> };
          }>;
        };
        return this.parseResponse(json);
      }

      // Rate limited — exponential backoff with 3x multiplier
      if (response.status === 429) {
        const delay = this.baseDelay * Math.pow(3, attempt);
        await this.delay(delay);
        continue;
      }

      // Server error — exponential backoff with 2x multiplier
      if (response.status >= 500) {
        if (attempt < maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await this.delay(delay);
          continue;
        }
        // Last attempt — fall through to throw
      }

      // Client error (4xx other than 429) — fail immediately
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Gemini API client error: ${response.status} ${response.statusText}`,
        );
      }
    }

    throw new Error('Gemini API: max retries exceeded');
  }

  /**
   * Parse the Gemini API response into an OcrExtractionResult.
   * @param json - Raw API response
   * @returns Parsed extraction result
   * @throws Error if response cannot be parsed
   */
  private parseResponse(json: {
    candidates: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  }): OcrExtractionResult {
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API: empty response — no content in candidates');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Gemini API: failed to parse JSON response: ${text.substring(0, 200)}`,
      );
    }

    // Extract field confidences if embedded in the response
    const fieldConfidences: Record<string, number> =
      (parsed['confidence'] as Record<string, number>) ??
      (parsed['field_confidences'] as Record<string, number>) ??
      {};

    return {
      rawText: text,
      extractedData: parsed,
      fieldConfidences,
    };
  }

  /**
   * Parse classification-specific fields from the extraction result.
   * @param result - Raw extraction result
   * @returns Result with classification details extracted
   */
  private parseClassificationResult(
    result: OcrExtractionResult,
  ): OcrExtractionResult {
    const data = result.extractedData;
    const classification = data['classification'] as
      | { schema_name: string; confidence: number; reason: string }
      | undefined;

    if (classification) {
      return {
        ...result,
        extractedData:
          (data['extracted_data'] as Record<string, unknown>) ?? data,
        classification: {
          schemaName: classification.schema_name,
          confidence: classification.confidence,
          reason: classification.reason,
        },
      };
    }

    return result;
  }

  /**
   * Delay execution for a given number of milliseconds.
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
