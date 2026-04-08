# Action Guide: Session 20 — Invoice DTO Expansion + File/Trace Endpoints

> Created: 2026-04-08 | Created by: Antigravity (Claude Opus 4.6)
> Phase Step: 2.C.1 (Review Depth — Backend)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 19 (Duplicate policy + reprocess) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `invoice-tool/packages/backend/`) → 0 errors
- [ ] Tests passing: `npm test` (from `invoice-tool/`) → 477 tests all green
- [ ] Required files exist:
  - `invoice-tool/packages/backend/src/domain/invoice/invoice.entity.ts` (Invoice entity with all getters)
  - `invoice-tool/packages/backend/src/interface/http/invoice.controller.ts` (InvoiceController)
  - `invoice-tool/packages/backend/src/interface/http/dto/invoice-response.dto.ts` (current 19-field DTO)
  - `invoice-tool/packages/backend/src/infrastructure/database/schema.ts` (has `processing_traces` table)
  - `invoice-tool/packages/backend/src/domain/shared/file-storage.ts` (IFileStorage port)

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
The review screen must be a real verification surface. Operators need to see the original PDF, line items, per-field confidence scores, validation errors, OCR raw text, classification method, and the full processing pipeline trace to make informed approve/reject decisions. Currently, `InvoiceResponseDto` only exposes 19 scalar fields — hiding all the evidence the entity already stores. There's no endpoint to serve the original PDF, and pipeline stage timings are collected in memory but never persisted.

Reference: `tasks/01-business-spec.md` § F08 (Review Queue & Approval), § F09 (Dashboard — per-invoice tracing)

### Architecture Context
This session touches 3 layers in the PROCESSING bounded context:
- **Domain**: New `ProcessingTrace` entity + `IProcessingTraceRepository` interface
- **Infrastructure**: New `ProcessingTraceRepositoryImpl` (Drizzle) + persist traces in `ProcessInvoiceUseCase`
- **Interface**: Expand `InvoiceResponseDto`, add 2 new controller endpoints (`GET /file`, `GET /traces`)

Reference: `tasks/06-low-level-design.md` § Processing Context

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| `invoices` | Already stores all fields — DTO just needs to expose them |
| `processing_traces` | Exists but empty — needs entity + repo + persistence in use case |

Schema for `processing_traces` (already defined in `schema.ts:111-121`):
```sql
CREATE TABLE processing_traces (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  stage TEXT NOT NULL,           -- 'classify' | 'extract' | 'validate' | 'score' | 'route'
  status TEXT NOT NULL,          -- 'completed' | 'failed'
  input_data TEXT,               -- JSON serialized stage input (optional)
  output_data TEXT,              -- JSON serialized stage output (optional)
  error_message TEXT,            -- Error message if failed
  duration_ms INTEGER,           -- Stage duration in milliseconds
  created_at TEXT NOT NULL       -- ISO 8601 timestamp
);
```

### Data Flow
`ProcessInvoiceUseCase.execute()` → collects `stages: StageResult[]` in memory → currently returns them but NEVER persists to DB → this session adds persistence after each stage completes.

File serving: `GET /api/invoices/:id/file` → read `invoice.storagePath` → `IFileStorage.readFile(path)` → return as `StreamableFile`.

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — ProcessingTrace entity creation
2. `.agents/skills/repository-implementation/skill.md` — Drizzle repo for traces
3. `.agents/skills/api-controller/skill.md` — New endpoints + DTO expansion
4. `.agents/skills/bdd-test-writing/skill.md` — Tests for new entity, repo, endpoints
5. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-api.md` — for the controller endpoint changes
- `.agents/workflows/implement-domain.md` — for the trace entity
- `.agents/workflows/quality-gate-pipeline.md` — final verification

### Relevant Learned Rules
- `InvoiceResponseDto` currently maps `overallConfidence` → `confidenceScore` — keep this field + add new ones
- `IFileStorage.readFile(relativePath)` returns `Promise<Buffer>` — use for streaming
- NestJS file download uses `StreamableFile` + `@Res({ passthrough: true })` pattern
- Smoke test MANDATORY — this session touches `*.module.ts` and `@Inject()` decorators
- Domain services are stateless — ProcessingTrace is a simple data entity, not a service
- `lineItems` stored as JSON TEXT in DB — `JSON.parse()` on read

---

## 3. Tasks (Ordered)

### Task 1: ProcessingTrace Domain Entity + Repository Interface

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/domain/processing/processing-trace.entity.ts`
**Repo**: `invoice-tool/packages/backend/src/domain/processing/processing-trace.repository.ts`
**Test**: `invoice-tool/packages/backend/src/domain/processing/__tests__/processing-trace.entity.spec.ts`

**What to do**:
1. Create `ProcessingTrace` entity with `create()` and `reconstitute()` static methods
2. Create `IProcessingTraceRepository` interface
3. Export both from `domain/processing/index.ts`
4. Write BDD tests for entity creation + validation

**Key types**:
```typescript
interface CreateTraceProps {
  id?: string;
  invoiceId: string;
  stage: string;        // 'classify' | 'extract' | 'validate' | 'score' | 'route'
  status: string;       // 'completed' | 'failed'
  inputData?: string | null;
  outputData?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
}

interface ProcessingTraceProps {
  id: string;
  invoiceId: string;
  stage: string;
  status: string;
  inputData: string | null;
  outputData: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
}

interface IProcessingTraceRepository {
  save(trace: ProcessingTrace): Promise<void>;
  findByInvoiceId(invoiceId: string): Promise<ProcessingTrace[]>;
}
```

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| invoiceId required | throw DomainError if empty | Empty string |
| stage required | throw DomainError if empty | Empty string |
| status required | throw DomainError if empty | Empty string |
| durationMs non-negative | Allow null, but if provided must be >= 0 | Negative value |
| createdAt auto-set | Set to `new Date()` on create | — |

**Verify** (from `invoice-tool/packages/backend/`): `npx jest --testPathPattern="processing-trace" --bail`

---

### Task 2: ProcessingTrace Repository Implementation

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/infrastructure/database/repositories/processing-trace.repository.impl.ts`
**Test**: `invoice-tool/packages/backend/src/infrastructure/database/repositories/__tests__/processing-trace.repository.impl.spec.ts`

**What to do**:
1. Implement `ProcessingTraceRepositoryImpl` with Drizzle
2. `save()` → upsert into `processingTraces` table
3. `findByInvoiceId()` → query + order by `createdAt` ASC
4. Write integration tests using `createTestDb()`

**Key mapping** (entity ↔ DB):
```typescript
// Entity → DB
{ id, invoiceId, stage, status, inputData, outputData, errorMessage, durationMs, createdAt: date.toISOString() }

// DB → Entity
ProcessingTrace.reconstitute({ ...row, createdAt: new Date(row.createdAt) })
```

**Verify**: `npx jest --testPathPattern="processing-trace.repository" --bail`

---

### Task 3: Persist Traces in ProcessInvoiceUseCase

**Type**: GREEN (modify existing)
**File**: `invoice-tool/packages/backend/src/application/processing/process-invoice.use-case.ts`
**Test**: `invoice-tool/packages/backend/src/application/processing/__tests__/process-invoice.use-case.spec.ts`

**What to do**:
1. Inject `IProcessingTraceRepository` into constructor (with `@Optional()` to avoid breaking existing tests)
2. After each stage completes, persist a `ProcessingTrace` entity
3. After `failInvoice()`, persist the failed stage trace too
4. Update existing tests to provide mock trace repo

**Business rules**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Trace after each stage | Create + save trace after classify, extract, validate, score, route | — |
| Failed stage trace | Still persists with status='failed' and errorMessage | Error in classify |
| Optional injection | Use `@Optional()` so existing tests without trace repo don't break | — |

**Verify**: `npx jest --testPathPattern="process-invoice" --bail`

---

### Task 4: Expand InvoiceResponseDto

**Type**: GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/dto/invoice-response.dto.ts`

**What to do**:
Add ALL missing fields that the Invoice entity already stores:

```typescript
// New fields to add to InvoiceResponseDto:
lineItems?: LineItemResponseDto[] | null;    // Array of line items
ocrRawText?: string | null;                  // Raw OCR text
extractedRawJson?: string | null;            // Raw JSON from AI
fieldConfidences?: Record<string, number> | null;  // Per-field confidence map (parsed from JSON)
validationErrors?: { errors: string[], warnings: string[] } | null;  // Parsed validation errors
classificationMethod?: string | null;        // 'fingerprint' | 'llm' | 'manual' | 'frontend_hint'
classificationConfidence?: number | null;     // Classification confidence score
storagePath?: string | null;                  // File storage path
pageCount?: number | null;                    // PDF page count
fileHash?: string | null;                     // SHA-256 file hash
duplicateOf?: string | null;                  // ID of original if duplicate
processedAt?: string | null;                  // ISO timestamp
reviewedAt?: string | null;                   // ISO timestamp
reviewedBy?: string | null;                   // Reviewer identifier
updatedAt?: string | null;                    // ISO timestamp
```

Also create `LineItemResponseDto`:
```typescript
class LineItemResponseDto {
  name!: string;
  unit?: string | null;
  quantity!: number;
  unitPrice!: number;
  amount!: number;
  vatRate?: number | null;
  vatAmount?: number | null;
  totalWithVat?: number | null;
}
```

Update `toResponseDto()` in the controller to map all new fields.

---

### Task 5: Processing Trace Response DTO

**Type**: GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/dto/processing-trace-response.dto.ts` (NEW)

```typescript
class ProcessingTraceResponseDto {
  id!: string;
  invoiceId!: string;
  stage!: string;
  status!: string;
  inputData?: string | null;
  outputData?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  createdAt!: string;
}
```

---

### Task 6: New Controller Endpoints + Tests

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/invoice.controller.ts`
**Test**: `invoice-tool/packages/backend/src/interface/http/__tests__/invoice.controller.spec.ts`

**What to do**:
1. Add `GET /invoices/:id/file` → read file from IFileStorage, return as `StreamableFile`
2. Add `GET /invoices/:id/traces` → query IProcessingTraceRepository by invoiceId
3. Inject `IFileStorage` and `IProcessingTraceRepository` into controller
4. Update `toResponseDto()` to map all new fields including parsed JSON
5. Write controller tests for both new endpoints

**Endpoint details**:

```typescript
// GET /invoices/:id/file
@Get(':id/file')
@ApiOperation({ summary: 'Download original invoice file' })
@ApiProduces('application/pdf')
async getInvoiceFile(
  @Param('id') id: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const invoice = await this.invoiceRepo.findById(id);
  if (!invoice) throw new NotFoundException('Invoice not found');
  const buffer = await this.fileStorage.readFile(invoice.storagePath);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${invoice.originalFilename}"`,
  });
  return new StreamableFile(buffer);
}

// GET /invoices/:id/traces
@Get(':id/traces')
@ApiOperation({ summary: 'Get processing trace for an invoice' })
async getInvoiceTraces(@Param('id') id: string): Promise<ProcessingTraceResponseDto[]> {
  const traces = await this.traceRepo.findByInvoiceId(id);
  return traces.map(t => ({
    id: t.id,
    invoiceId: t.invoiceId,
    stage: t.stage,
    status: t.status,
    inputData: t.inputData,
    outputData: t.outputData,
    errorMessage: t.errorMessage,
    durationMs: t.durationMs,
    createdAt: t.createdAt.toISOString(),
  }));
}
```

**Verify**: `npx jest --testPathPattern="invoice.controller" --bail`

---

### Task 7: Register & Wire NestJS Modules

**Type**: GREEN
**Files**:
- `invoice-tool/packages/backend/src/infrastructure/database/database.module.ts` — register ProcessingTraceRepositoryImpl
- `invoice-tool/packages/backend/src/application/application.module.ts` — import trace repo token
- `invoice-tool/packages/backend/src/interface/interface.module.ts` — import FileStorageModule for controller

**What to do**:
1. Add `IProcessingTraceRepository` provider to `DatabaseModule`
2. Ensure `ProcessInvoiceUseCase` can access the new repo
3. Ensure `InvoiceController` can access `IFileStorage` and `IProcessingTraceRepository`
4. Run smoke test after wiring

---

### Task 8: Update E2E Test

**Type**: GREEN
**File**: `invoice-tool/packages/backend/__tests__/e2e/full-flow.e2e.spec.ts`

**What to do**: Add mock `IProcessingTraceRepository` provider to E2E test module bootstrap.

---

### Task 9: Update Frontend API Client Types

**Type**: GREEN
**File**: `invoice-tool/packages/frontend/src/lib/api-client.ts`

**What to do**:
1. Expand `InvoiceResponse` type with all new fields
2. Add `LineItemResponse` type
3. Add `ProcessingTraceResponse` type
4. Add `getInvoiceFile(id)` method (returns blob URL or direct URL construction)
5. Add `getInvoiceTraces(id)` method

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from invoice-tool/packages/backend/ directory
npx tsc --noEmit

# Tests — from invoice-tool/ directory
npm test

# Backend smoke test (MANDATORY — changed *.module.ts + @Inject) — from project root
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# Frontend build — from invoice-tool/packages/frontend/
npm run build

# Architecture (domain purity) — use grep_search tool:
#   query "@nestjs" in invoice-tool/packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in invoice-tool/packages/backend/src/domain/  → expect 0 results
#   query ": any" in invoice-tool/packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] `GET /api/invoices/:id` returns lineItems, fieldConfidences, ocrRawText, validationErrors, classificationMethod, storagePath, pageCount, fileHash
- [ ] `GET /api/invoices/:id/file` streams the original PDF with correct Content-Type
- [ ] `GET /api/invoices/:id/traces` returns ordered stage trace data
- [ ] ProcessingTrace entity exists with create/reconstitute + BDD tests
- [ ] ProcessingTraceRepositoryImpl persists traces to SQLite
- [ ] ProcessInvoiceUseCase persists traces after each pipeline stage
- [ ] Frontend API client types updated with all new fields
- [ ] All tests pass (target: ≥490 tests)
- [ ] `tsc --noEmit` passes (backend)
- [ ] `npm run build` passes (frontend)
- [ ] Smoke test passes
- [ ] No architecture violations (domain layer pure)

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: InvoiceResponseDto expanded, file/trace endpoints added, trace persistence
   - Found: {any surprises}
   - What's Next: "Session 21: PDF viewer + verification UI + batch detail" (Phase 2.C.2)

2. Update `.context/agent-notes.md`:
   - Test count update
   - Any new learned rules

3. Update `tasks/progress.md`:
   - Mark 2.C.1 as ✅ Done with session 20 and test count

4. Commit: `feat: expand invoice DTO + add file/trace endpoints + persist pipeline traces`

**Next session depends on**: All new DTO fields and endpoints working — Session 21 will build the frontend review UI against these APIs.
