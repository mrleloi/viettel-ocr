---
name: Pipeline Stage Implementation
description: How to implement a processing pipeline stage (classify, extract, validate, map, score, route).
context-load: once
---

# Skill: Pipeline Stage

## When to Use
Implementing any stage of the invoice processing pipeline in the PROCESSING bounded context.

## Pipeline Stages Reference

```
PREPROCESS → DEDUP → CLASSIFY → EXTRACT → VALIDATE → MAP → SCORE → ROUTE → ACTION
```

Each stage is a domain service with:
1. Clear input/output types
2. Trace entry logging
3. Error handling (fail gracefully, don't crash pipeline)

## Stage Service Pattern

```typescript
// domain/processing/validator.service.ts
export interface ValidationInput {
  extractedData: Record<string, unknown>;
  schema: SchemaWithFields;
}

export interface ValidationOutput {
  errors: ValidationError[];
  passRate: number;  // 0.0 - 1.0
}

export class ValidatorService {
  validate(input: ValidationInput): ValidationOutput {
    const errors: ValidationError[] = [];
    // Pure logic — no DB, no API calls
    // Check each field against schema definition
    return { errors, passRate: 1 - (errors.length / totalChecks) };
  }
}
```

## Pipeline Orchestrator Pattern

```typescript
// domain/processing/pipeline.service.ts
export class ProcessingPipeline {
  async processInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    
    // Each stage wrapped in trace + error handling
    const classifyResult = await this.runStage('classify', () =>
      this.classifier.classify(invoice)
    );
    
    const extractResult = await this.runStage('extract', () =>
      this.extractor.extract(invoice, classifyResult.schema)
    );
    
    // Continue through stages...
  }

  private async runStage<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      await this.traceRepo.save({ step: name, status: 'completed', durationMs: Date.now() - start });
      return result;
    } catch (error) {
      await this.traceRepo.save({ step: name, status: 'failed', error: error.message });
      throw error;
    }
  }
}
```

## Gemini API Call Pattern

```typescript
// infrastructure/ai/gemini.client.ts
// This is INFRASTRUCTURE — not domain
export class GeminiClient {
  async extract(pdfBase64: string, promptTemplate: string): Promise<ExtractionResult> {
    // Retry logic, rate limiting, error handling
    // Returns structured result to domain layer
  }
}
```

## Testing Pipeline Stages

Each stage is a pure domain service → test without mocks:
```typescript
describe('ValidatorService', () => {
  const sut = new ValidatorService();
  
  it('should pass when all required fields present', () => {
    const result = sut.validate({ extractedData: fullData, schema });
    expect(result.errors).toHaveLength(0);
    expect(result.passRate).toBe(1.0);
  });

  it('should fail when total != subtotal + vat', () => {
    const result = sut.validate({ extractedData: mismatchedTotals, schema });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'total', rule: 'cross_field_sum' })
    );
  });
});
```
