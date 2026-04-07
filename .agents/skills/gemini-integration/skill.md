---
name: Gemini Integration
description: How to integrate with Gemini Flash API for OCR and extraction.
context-load: once
---

# Skill: Gemini Integration

## Architecture

```
Domain (OcrService interface) ← Infrastructure (GeminiClient implementation)
```

The domain defines WHAT it needs. Infrastructure provides HOW.

## Domain Interface

```typescript
// domain/processing/ocr.service.ts (INTERFACE)
export interface OcrExtractionResult {
  rawText: string;
  extractedData: Record<string, unknown>;
  fieldConfidences: Record<string, number>;
  classification?: { schemaName: string; confidence: number };
}

export interface IOcrService {
  extract(pdfBase64: string, promptTemplate: string): Promise<OcrExtractionResult>;
  extractAndClassify(pdfBase64: string, schemaList: SchemaInfo[]): Promise<OcrExtractionResult>;
}
```

## Infrastructure Implementation

```typescript
// infrastructure/ai/gemini.client.ts
@Injectable()
export class GeminiClient implements IOcrService {
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  
  constructor(private readonly config: EnvConfigService) {}

  async extract(pdfBase64: string, promptTemplate: string): Promise<OcrExtractionResult> {
    const body = {
      contents: [{
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
          { text: promptTemplate }
        ]
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    };
    
    return this.callWithRetry(body);
  }

  private async callWithRetry(body: unknown, attempts = 3): Promise<OcrExtractionResult> {
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(`${this.apiUrl}?key=${this.config.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 429) { await this.delay(1000 * Math.pow(3, i)); continue; }
        if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
        return this.parseResponse(await res.json());
      } catch (e) {
        if (i === attempts - 1) throw e;
        await this.delay(1000 * Math.pow(2, i));
      }
    }
    throw new Error('Gemini API: max retries exceeded');
  }
}
```

## Prompt Strategy

**Known schema** (user selected NCC or fingerprint matched):
- Short, focused prompt
- List exact fields to extract from schema field definitions
- Output: JSON matching schema template
- Cost: minimal

**Unknown schema** (classification needed):
- Longer prompt: include list of known schemas with descriptions
- Ask Gemini to classify AND extract in single call
- Output: classification + extracted data
- Cost: higher but rare (<5% of invoices)

## Cost Tracking

```typescript
// Log estimated cost per API call
const estimatedCost = inputTokens * 0.000001 + outputTokens * 0.000004; // Gemini Flash pricing
await this.traceRepo.save({ step: 'ocr_extract', apiCostUsd: estimatedCost });
```

## Testing
- Mock the HTTP call in tests — don't call real API
- Test retry logic with simulated 429/500 errors
- Test JSON parsing with sample Gemini responses
- Store sample responses as fixtures for consistent testing
