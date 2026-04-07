/**
 * OCR extraction result from AI processing.
 */
export interface OcrExtractionResult {
  /** Raw OCR text from the PDF */
  rawText: string;
  /** Structured extracted data as key-value pairs */
  extractedData: Record<string, unknown>;
  /** Per-field confidence scores (0.0-1.0) */
  fieldConfidences: Record<string, number>;
  /** Classification result (only present in unknown schema mode) */
  classification?: {
    schemaName: string;
    confidence: number;
    reason: string;
  };
}

/**
 * Schema info for classification mode.
 */
export interface SchemaInfo {
  /** Schema name */
  name: string;
  /** Schema description */
  description: string;
  /** NCC tax ID */
  nccTaxId: string;
}

/**
 * Domain port interface for OCR/AI extraction service.
 *
 * Infrastructure implementations (e.g., GeminiClient) provide the concrete
 * API integration. Domain layer depends only on this interface.
 */
export interface IOcrService {
  /**
   * Extract structured data from a PDF using a known schema prompt.
   * @param pdfBase64 - Base64-encoded PDF file
   * @param promptTemplate - Schema-specific extraction prompt
   * @returns Extraction result with structured data and confidence scores
   */
  extract(pdfBase64: string, promptTemplate: string): Promise<OcrExtractionResult>;

  /**
   * Extract and classify a PDF against known schemas.
   * Used when schema is unknown (mixed/new upload mode).
   * @param pdfBase64 - Base64-encoded PDF file
   * @param schemaList - List of known schemas for classification
   * @returns Extraction result with classification info
   */
  extractAndClassify(
    pdfBase64: string,
    schemaList: SchemaInfo[],
  ): Promise<OcrExtractionResult>;
}
