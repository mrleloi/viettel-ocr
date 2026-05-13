import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  IOcrService,
  OcrExtractionResult,
  SchemaInfo,
} from '../../domain/processing/ocr.service';
import { EnvConfigService } from '../config/env-config.service';
import { RateLimiter } from '../queue/rate-limiter.service';

/**
 * Gemini Flash API client implementing the IOcrService domain port.
 *
 * Provides OCR extraction and classification capabilities using Google's
 * Gemini 2.0 Flash model. Includes retry logic with exponential backoff.
 */
@Injectable()
export class GeminiClient implements IOcrService {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly apiUrl: string;
  private readonly baseDelay: number;

  constructor(
    private readonly config: EnvConfigService,
    @Optional() private readonly rateLimiter?: RateLimiter,
  ) {
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
    this.baseDelay = 2000;
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
      value: `https://generativelanguage.googleapis.com/v1beta/models/${(config as any).geminiModel || 'gemini-2.5-pro'}:generateContent`,
    });
    Object.defineProperty(instance, 'baseDelay', { value: baseDelay });
    Object.defineProperty(instance, 'logger', { value: new Logger(GeminiClient.name) });
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
    let lastStatus: number | null = null;
    let lastBody: string | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Rate-limit outbound calls (token bucket, waits if quota exhausted)
      if (this.rateLimiter) {
        await this.rateLimiter.acquire();
      }

      let response: Response;
      try {
        response = await fetch(
          `${this.apiUrl}?key=${this.config.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`fetch threw on attempt ${attempt + 1}: ${msg}`);
        if (attempt < maxRetries - 1) {
          await this.delay(this.baseDelay * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Gemini API: network error after ${maxRetries} attempts: ${msg}`);
      }

      if (response.ok) {
        const json = (await response.json()) as {
          candidates: Array<{
            content: { parts: Array<{ text: string }> };
          }>;
        };
        return this.parseResponse(json);
      }

      lastStatus = response.status;
      try {
        lastBody = typeof response.text === 'function' ? await response.text() : null;
      } catch {
        lastBody = '<unreadable response body>';
      }
      this.logger.error(
        `Gemini API attempt ${attempt + 1} returned ${response.status} ${response.statusText}: ${lastBody?.substring(0, 500)}`,
      );

      // Rate limited or 503 overloaded — exponential backoff with 3x multiplier
      if (response.status === 429 || response.status === 503) {
        const delay = this.baseDelay * Math.pow(3, attempt);
        this.logger.warn(
          `Gemini API ${response.status} on attempt ${attempt + 1}/${maxRetries}, retrying in ${Math.round(delay / 1000)}s...`,
        );
        await this.delay(delay);
        continue;
      }

      // Other server errors (500, 502, 504) — exponential backoff with 2x multiplier
      if (response.status >= 500) {
        if (attempt < maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          this.logger.warn(
            `Gemini API ${response.status} on attempt ${attempt + 1}/${maxRetries}, retrying in ${Math.round(delay / 1000)}s...`,
          );
          await this.delay(delay);
          continue;
        }
        // Last attempt — fall through to throw
      }

      // Client error (4xx other than 429) — fail immediately
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Gemini API client error: ${response.status} ${response.statusText} — ${lastBody?.substring(0, 500)}`,
        );
      }
    }

    throw new Error(
      `Gemini API: max retries exceeded (last status=${lastStatus ?? 'n/a'}, body=${lastBody?.substring(0, 500) ?? 'n/a'})`,
    );
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
