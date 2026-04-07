# Low-Level Design

**Version**: 1.0  
**Date**: 2026-04-07  

---

## 1. Project Structure (Monorepo)

```
invoice-tool/
├── package.json                    # Workspace root
├── config.env                      # User-editable config (API keys, ports)
├── config.env.example              # Template
├── README.md
├── scripts/
│   ├── setup.js                    # npm run setup → install + migrate + seed
│   ├── start.js                    # npm start → start backend + frontend
│   └── migrate.js                  # Database migrations
│
├── packages/
│   ├── shared/                     # Shared types & contracts
│   │   ├── package.json
│   │   └── src/
│   │       ├── domain/             # Domain value objects & types
│   │       │   ├── invoice.ts
│   │       │   ├── schema.ts
│   │       │   ├── mapping.ts
│   │       │   ├── product.ts
│   │       │   ├── batch.ts
│   │       │   └── confidence.ts
│   │       ├── api/                # OpenAPI-generated types
│   │       │   └── generated/      # Auto-generated client
│   │       └── constants/
│   │           ├── statuses.ts
│   │           ├── validation-rules.ts
│   │           └── config-keys.ts
│   │
│   ├── backend/                    # NestJS API server
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/                # Migration files
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       │
│   │       ├── domain/             # Domain layer (DDD)
│   │       │   ├── invoice/
│   │       │   │   ├── invoice.entity.ts
│   │       │   │   ├── invoice.value-objects.ts
│   │       │   │   ├── invoice.repository.ts    # Interface
│   │       │   │   ├── invoice.service.ts       # Domain logic
│   │       │   │   └── invoice.events.ts
│   │       │   ├── schema/
│   │       │   │   ├── schema.entity.ts
│   │       │   │   ├── schema.repository.ts
│   │       │   │   ├── schema.service.ts
│   │       │   │   ├── fingerprint.service.ts
│   │       │   │   └── prompt-builder.service.ts
│   │       │   ├── mapping/
│   │       │   │   ├── mapping.entity.ts
│   │       │   │   ├── mapping.repository.ts
│   │       │   │   ├── mapping.service.ts
│   │       │   │   └── fuzzy-matcher.service.ts
│   │       │   ├── product/
│   │       │   │   ├── product.entity.ts
│   │       │   │   ├── product.repository.ts
│   │       │   │   ├── product.service.ts
│   │       │   │   └── sync.service.ts
│   │       │   └── processing/
│   │       │       ├── pipeline.service.ts      # Orchestrator
│   │       │       ├── classifier.service.ts
│   │       │       ├── validator.service.ts
│   │       │       ├── confidence-calculator.service.ts
│   │       │       └── router.service.ts
│   │       │
│   │       ├── application/        # Application layer (use cases)
│   │       │   ├── upload/
│   │       │   │   ├── upload-batch.use-case.ts
│   │       │   │   └── cancel-batch.use-case.ts
│   │       │   ├── processing/
│   │       │   │   ├── process-invoice.use-case.ts
│   │       │   │   └── reprocess-invoice.use-case.ts
│   │       │   ├── review/
│   │       │   │   ├── approve-invoice.use-case.ts
│   │       │   │   ├── reject-invoice.use-case.ts
│   │       │   │   └── edit-invoice.use-case.ts
│   │       │   ├── schema/
│   │       │   │   ├── create-schema.use-case.ts
│   │       │   │   ├── update-schema.use-case.ts
│   │       │   │   └── test-schema.use-case.ts
│   │       │   ├── mapping/
│   │       │   │   ├── create-mapping.use-case.ts
│   │       │   │   ├── bulk-import-mapping.use-case.ts
│   │       │   │   └── auto-learn-mapping.use-case.ts
│   │       │   ├── product/
│   │       │   │   ├── sync-products.use-case.ts
│   │       │   │   └── resolve-conflict.use-case.ts
│   │       │   └── export/
│   │       │       └── create-export.use-case.ts
│   │       │
│   │       ├── infrastructure/     # Infrastructure layer
│   │       │   ├── database/
│   │       │   │   ├── schema.ts           # Drizzle table definitions
│   │       │   │   ├── connection.ts
│   │       │   │   └── repositories/       # Concrete repository implementations
│   │       │   │       ├── invoice.repository.impl.ts
│   │       │   │       ├── schema.repository.impl.ts
│   │       │   │       ├── mapping.repository.impl.ts
│   │       │   │       └── product.repository.impl.ts
│   │       │   ├── ai/
│   │       │   │   ├── gemini.client.ts
│   │       │   │   └── gemini.config.ts
│   │       │   ├── file-storage/
│   │       │   │   └── local-storage.service.ts
│   │       │   ├── queue/
│   │       │   │   ├── job-queue.service.ts
│   │       │   │   └── job.entity.ts
│   │       │   ├── external-api/
│   │       │   │   ├── viettel-product.client.ts
│   │       │   │   └── mock-product.client.ts
│   │       │   └── config/
│   │       │       └── env-config.service.ts
│   │       │
│   │       └── interface/          # Interface layer (controllers)
│   │           ├── http/
│   │           │   ├── batch.controller.ts
│   │           │   ├── invoice.controller.ts
│   │           │   ├── schema.controller.ts
│   │           │   ├── mapping.controller.ts
│   │           │   ├── product.controller.ts
│   │           │   ├── export.controller.ts
│   │           │   ├── notification.controller.ts
│   │           │   ├── diagnostic.controller.ts
│   │           │   └── health.controller.ts
│   │           ├── sse/
│   │           │   └── events.controller.ts
│   │           └── dto/
│   │               ├── batch.dto.ts
│   │               ├── invoice.dto.ts
│   │               └── ...
│   │
│   ├── frontend/                   # Next.js application
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── src/
│   │       ├── app/                # Next.js App Router
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx                    # → redirect to /dashboard
│   │       │   ├── dashboard/
│   │       │   │   └── page.tsx
│   │       │   ├── upload/
│   │       │   │   └── page.tsx
│   │       │   ├── review/
│   │       │   │   ├── page.tsx                # Review queue list
│   │       │   │   └── [id]/
│   │       │   │       └── page.tsx            # Single invoice review
│   │       │   ├── schemas/
│   │       │   │   ├── page.tsx                # Schema list
│   │       │   │   ├── new/
│   │       │   │   │   └── page.tsx            # Schema wizard
│   │       │   │   └── [id]/
│   │       │   │       └── page.tsx            # Schema detail/edit
│   │       │   ├── mappings/
│   │       │   │   └── page.tsx
│   │       │   ├── products/
│   │       │   │   └── page.tsx
│   │       │   ├── exports/
│   │       │   │   └── page.tsx
│   │       │   └── diagnostics/
│   │       │       └── page.tsx
│   │       │
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   ├── Header.tsx
│   │       │   │   └── NotificationBell.tsx
│   │       │   ├── upload/
│   │       │   │   ├── FileDropzone.tsx
│   │       │   │   ├── NccSelector.tsx
│   │       │   │   ├── BatchTemplateSelector.tsx
│   │       │   │   └── BatchProgress.tsx
│   │       │   ├── review/
│   │       │   │   ├── PdfViewer.tsx
│   │       │   │   ├── ExtractedDataPanel.tsx
│   │       │   │   ├── FieldEditor.tsx
│   │       │   │   ├── ConfidenceBadge.tsx
│   │       │   │   └── ReviewActions.tsx
│   │       │   ├── schema/
│   │       │   │   ├── SchemaWizard.tsx
│   │       │   │   ├── FieldMapper.tsx
│   │       │   │   ├── FingerprintRuleEditor.tsx
│   │       │   │   ├── BehaviorConfig.tsx
│   │       │   │   └── SchemaTestRunner.tsx
│   │       │   ├── mapping/
│   │       │   │   ├── MappingTable.tsx
│   │       │   │   ├── MappingSuggestion.tsx
│   │       │   │   └── BulkImportDialog.tsx
│   │       │   ├── product/
│   │       │   │   ├── ProductList.tsx
│   │       │   │   ├── SyncButton.tsx
│   │       │   │   └── ConflictResolver.tsx
│   │       │   └── common/
│   │       │       ├── DataTable.tsx
│   │       │       ├── StatusBadge.tsx
│   │       │       ├── DateFilter.tsx
│   │       │       └── SearchInput.tsx
│   │       │
│   │       ├── hooks/
│   │       │   ├── useSSE.ts
│   │       │   ├── useBatchProgress.ts
│   │       │   └── useNotifications.ts
│   │       │
│   │       ├── lib/
│   │       │   ├── api-client.ts       # Generated OpenAPI client wrapper
│   │       │   └── utils.ts
│   │       │
│   │       └── stores/
│   │           └── ui.store.ts         # Zustand store
│   │
│   └── mock-server/                # Mock Viettel Product API
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── data/
│           │   └── products.json   # Sample product data
│           └── routes/
│               └── products.ts
│
└── data/                           # Runtime data (gitignored)
    ├── database.sqlite
    ├── uploads/
    └── exports/
```

---

## 2. Key Domain Logic Details

### 2.1 Fingerprint Service

```typescript
// domain/schema/fingerprint.service.ts

interface FingerprintResult {
  matched: boolean;
  schemaId: string | null;
  score: number;           // 0.0 - 1.0
  matchedRules: string[];  // which rules matched
}

class FingerprintService {
  /**
   * Run all active schema fingerprint rules against OCR text.
   * Returns best match (highest priority rule that matches).
   * 
   * Algorithm:
   * 1. Load all active schemas with their fingerprint rules
   * 2. For each schema, evaluate rules in priority order
   * 3. Score: mst_exact = 1.0, keyword = 0.7, symbol_regex = 0.8, custom = 0.6
   * 4. Return highest scoring schema
   */
  classify(ocrText: string, sellerTaxId?: string): FingerprintResult;
}
```

### 2.2 Confidence Calculator

```typescript
// domain/processing/confidence-calculator.service.ts

interface ConfidenceInput {
  frontendHintSchemaId: string | null;
  matchedSchemaId: string | null;
  classificationMethod: 'frontend_hint' | 'fingerprint' | 'llm' | 'manual';
  fingerprintScore: number;
  fieldConfidences: Record<string, number>;
  validationPassRate: number;    // 0-1: ratio of passed validation rules
  mappingCompleteness: number;   // 0-1: ratio of mapped line items
  hintMatchesFingerprint: boolean;
}

class ConfidenceCalculator {
  /**
   * Composite confidence score.
   * 
   * Weights:
   *   frontend_hint_score:    0.30 (1.0 if hint provided & matches, 0.5 if hint but no fingerprint, 0.0 if no hint)
   *   fingerprint_score:      0.25 (from FingerprintService)
   *   extraction_quality:     0.25 (average of non-null field confidences)
   *   validation_pass_rate:   0.10
   *   mapping_completeness:   0.10
   * 
   * Penalties:
   *   - hint disagrees with fingerprint: -0.20
   *   - any required field null: -0.05 per field
   */
  calculate(input: ConfidenceInput): number;
}
```

### 2.3 Validation Service

```typescript
// domain/processing/validator.service.ts

interface ValidationError {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  expected?: string;
  actual?: string;
}

class ValidatorService {
  /**
   * Run all validation rules against extracted data.
   * Rules loaded from schema_field_definitions + hardcoded business rules.
   * Returns list of errors (empty = all pass).
   */
  validate(extractedData: Record<string, any>, schema: Schema): ValidationError[];
  
  /**
   * Cross-field validations: totals check, date logic, etc.
   */
  validateCrossFields(data: Record<string, any>): ValidationError[];
}
```

### 2.4 Processing Pipeline (Orchestrator)

```typescript
// domain/processing/pipeline.service.ts

class ProcessingPipeline {
  /**
   * Process a single invoice through all stages.
   * Each stage creates a trace entry.
   * Failure at any stage → status: error, remaining stages skipped.
   * 
   * Stages: dedup → classify → extract → validate → map → score → route → action
   */
  async processInvoice(invoiceId: string): Promise<void>;
  
  /**
   * Process all pending invoices in a batch.
   * Concurrency controlled by config (default 5).
   */
  async processBatch(batchId: string): Promise<void>;
}
```

### 2.5 Fuzzy Matcher

```typescript
// domain/mapping/fuzzy-matcher.service.ts

interface FuzzyMatchResult {
  productId: string;
  productCode: string;
  productName: string;
  score: number;          // 0.0 - 1.0
}

class FuzzyMatcher {
  /**
   * Find best matching Viettel products for a given partner product name.
   * 
   * Algorithm:
   * 1. Normalize: lowercase, strip Vietnamese diacritics, remove stop words
   * 2. Tokenize: split by spaces and special chars
   * 3. For each Viettel product, calculate:
   *    a. Jaccard similarity of token sets
   *    b. Longest common subsequence ratio
   *    c. Brand name bonus (+0.15 if brand token matches)
   * 4. Final score = 0.5 * jaccard + 0.3 * lcs_ratio + 0.2 * brand_bonus
   * 5. Return top N results above threshold
   */
  match(partnerProductName: string, nccTaxId?: string, topN?: number): FuzzyMatchResult[];
}
```

---

## 3. Gemini API Integration

### 3.1 Request Format

```typescript
// Known schema (optimized prompt — no classification needed)
{
  model: "gemini-2.0-flash",
  contents: [
    {
      parts: [
        { inlineData: { mimeType: "application/pdf", data: "<base64>" } },
        { text: `
Extract invoice data from this Vietnamese PDF. Return ONLY valid JSON.

Fields to extract:
- invoice_number (string): Số hóa đơn
- invoice_symbol (string): Ký hiệu
- invoice_date (string, YYYY-MM-DD): Ngày hóa đơn
- seller_name (string): Tên đơn vị bán
- seller_tax_id (string): MST bên bán
- buyer_name (string): Tên đơn vị mua
- buyer_tax_id (string): MST bên mua
- subtotal (integer): Cộng tiền hàng (VND)
- vat_rate (number): Thuế suất %
- vat_amount (integer): Tiền thuế GTGT (VND)
- total (integer): Tổng cộng tiền thanh toán (VND)
- po_number (string|null): Số PO/Hợp đồng nếu có
- invoice_type (string): "original"|"adjustment"|"replacement"
- line_items (array): [{name, unit, quantity, unit_price, amount, vat_rate, vat_amount, total_with_vat}]

For each field, include confidence (0.0-1.0).
All monetary values as integers (VND). Dates as YYYY-MM-DD.
If field not found, set null with confidence 0.
        ` }
      ]
    }
  ],
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0
  }
}
```

### 3.2 Unknown Schema (classification mode)

```typescript
// Additional instruction prepended to prompt:
`
First, classify this invoice. Known types:
${schemas.map(s => `- "${s.name}": ${s.description} (MST: ${s.ncc_tax_id})`).join('\n')}

Return JSON with:
- classification: {schema_name: string, confidence: number, reason: string}
- extracted_data: { ...standard fields... }
`
```

### 3.3 Error Handling & Retry

```typescript
class GeminiClient {
  private maxRetries = 3;
  private baseDelay = 1000; // ms

  async extract(pdfBase64: string, prompt: string): Promise<ExtractionResult> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.callApi(pdfBase64, prompt);
        const parsed = this.parseJsonResponse(response);
        return { success: true, data: parsed };
      } catch (error) {
        if (error.status === 429) {
          // Rate limited — wait longer
          await this.delay(this.baseDelay * Math.pow(3, attempt));
        } else if (error.status >= 500) {
          // Server error — retry
          await this.delay(this.baseDelay * Math.pow(2, attempt));
        } else {
          // Client error — don't retry
          return { success: false, error: error.message };
        }
      }
    }
    return { success: false, error: 'Max retries exceeded' };
  }
}
```

---

## 4. Queue Implementation

```typescript
// infrastructure/queue/job-queue.service.ts

/**
 * SQLite-backed in-process job queue.
 * No Redis, no external dependencies.
 * 
 * Table: processing_jobs
 *   id, invoice_id, status (pending|processing|completed|failed|cancelled),
 *   attempts, max_attempts, last_error, created_at, started_at, completed_at
 * 
 * Worker loop:
 * 1. Poll DB every 500ms for pending jobs
 * 2. Take up to N (concurrency) jobs: UPDATE SET status='processing' WHERE status='pending' LIMIT N
 * 3. Process each job in parallel (Promise.all with limit)
 * 4. On complete: UPDATE SET status='completed'
 * 5. On fail: INCREMENT attempts, if attempts >= max → status='failed', else status='pending' (retry)
 * 6. On startup: reset any 'processing' jobs to 'pending' (interrupted by crash)
 */
```

---

## 5. SSE Implementation

```typescript
// interface/sse/events.controller.ts

@Controller('api/events')
class EventsController {
  @Sse()
  events(): Observable<MessageEvent> {
    return this.eventBus.asObservable().pipe(
      map(event => ({
        data: JSON.stringify(event),
        type: event.type, // 'batch.progress' | 'notification.created' | etc.
      }))
    );
  }
}

// Frontend hook
function useSSE() {
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('batch.progress', (e) => { /* update progress */ });
    es.addEventListener('notification.created', (e) => { /* show toast */ });
    return () => es.close();
  }, []);
}
```
