# Action Guide: Session 7 — Job Queue + Upload/Processing Use Cases

> Created: 2026-04-07 | Created by: Antigravity
> Phase Step: 2.3 + 2.4a
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 6 — External Integrations → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → 278 passing
- [ ] Required files exist:
  - `packages/backend/src/domain/batch/batch.entity.ts`
  - `packages/backend/src/domain/batch/batch.repository.ts`
  - `packages/backend/src/domain/invoice/invoice.entity.ts`
  - `packages/backend/src/domain/invoice/invoice.repository.ts`
  - `packages/backend/src/domain/processing/ocr.service.ts` (IOcrService interface)
  - `packages/backend/src/domain/schema/fingerprint.service.ts`
  - `packages/backend/src/domain/schema/prompt-builder.service.ts`
  - `packages/backend/src/domain/processing/validator.service.ts`
  - `packages/backend/src/domain/processing/confidence-calculator.service.ts`
  - `packages/backend/src/domain/schema/schema.repository.ts`
  - `packages/backend/src/domain/schema/fingerprint-rule.repository.ts`
  - `packages/backend/src/domain/schema/field-definition.repository.ts`
  - `packages/backend/src/domain/shared/file-storage.ts` (IFileStorage interface)
  - `packages/backend/src/infrastructure/database/schema.ts` (has `processingJobs` table)

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

Operators upload PDF invoices (single, multiple, or ZIP). The system creates a batch, saves files, detects duplicates, and enqueues them for asynchronous processing. Processing runs invoices through a multi-stage pipeline: classify → extract → validate → score → route. Results are persisted and batch counters updated.

Reference: `tasks/01-business-spec.md` § F01 (File Upload), F02 (OCR & Extraction), F03 (Classification & Fingerprinting), F04 (Validation)

### Architecture Context

This session builds the **application layer** (use cases) and an **infrastructure queue service**. Use cases orchestrate domain services and repository calls. The queue decouples upload from processing, enabling async job execution.

**Bounded contexts involved**: INTAKE (Batch, Invoice creation), PROCESSING (pipeline stages)

**Layer**: `src/application/` (use cases) + `src/infrastructure/queue/` (job queue)

Reference: `tasks/06-low-level-design.md` § 2.4 Processing Pipeline, § 4 Queue Implementation

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| `batches` | Created by UploadBatchUseCase |
| `invoices` | Created per file in upload, updated by pipeline stages |
| `processing_jobs` | Queue entries: pending → processing → completed/failed |
| `processing_traces` | Trace entries logged per pipeline stage |
| `schemas` | Read during classification (fingerprint + prompt) |
| `fingerprint_rules` | Read during classification stage |
| `field_definitions` | Read during extraction stage (prompt building) |

Reference: `tasks/04-database-design.md` § 2.7-2.8, 2.13

### Data Flow

1. Upload → create Batch + Invoice records → save files → enqueue jobs
2. Queue worker polls processing_jobs → for each:
   - dedup check (file hash) → classify (fingerprint/LLM) → extract (Gemini) → validate → score → route
3. Each stage writes trace entry, updates invoice status
4. On completion, update batch counters

Reference: `tasks/05-data-flow-design.md` § 1 (Primary Flow: Stages 1-7)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/use-case-implementation/skill.md` — Use case pattern (Injectable, Inject, execute())
2. `.agents/skills/bdd-test-writing/skill.md` — RED phase test structure
3. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-use-case.md` — step-by-step for use case implementation
- `.agents/workflows/quality-gate-pipeline.md` — pre-commit verification

### Relevant Learned Rules
- DI Token Convention: `{ provide: 'ISchemaRepository', useClass: SchemaRepositoryImpl }`
- ConfigModule is `@Global()` + exports class directly — use direct class injection for EnvConfigService
- NestJS module pattern: `{ provide: 'IOcrService', useExisting: GeminiClient }`
- Domain services are stateless: no constructor DI, receive all data as method parameters
- `FingerprintService` uses `FingerprintRuleData[]` not entity classes
- `PromptBuilder` uses `SchemaData` and `FieldData` plain interfaces
- `ValidatorService` uses `ExtractedInvoiceData` plain interface
- `ConfidenceCalculator` uses `ConfidenceInput` plain interface
- Mock `global.fetch` pattern for AI/external client tests
- **NEVER run `npx jest` from monorepo root** — run from `packages/backend/`
- **OS**: Windows + PowerShell. Bash `&&` does NOT work. Use `;` or separate commands

---

## 3. Tasks (Ordered)

### Task 1: Job Queue Domain Interface (RED → GREEN)

**Type**: RED (test) → GREEN (implement)
**File**: `packages/backend/src/domain/shared/job-queue.ts`
**Test**: `packages/backend/src/domain/shared/__tests__/job-queue.spec.ts`

**What to do**:
Create a domain port interface `IJobQueue` that the application layer depends on. Then create the SQLite-backed infrastructure implementation.

**Key types**:
```typescript
// Domain port interface — packages/backend/src/domain/shared/job-queue.ts

export interface ProcessingJob {
  readonly id: string;
  readonly invoiceId: string;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface IJobQueue {
  /**
   * Add a job to the queue.
   * @param invoiceId - Invoice to process
   * @returns Created job ID
   */
  enqueue(invoiceId: string): Promise<string>;

  /**
   * Take up to N pending jobs, marking them as 'processing'.
   * This should be atomic to prevent double-processing.
   * @param limit - Max number of jobs to take
   * @returns Array of jobs now in 'processing' status
   */
  takePending(limit: number): Promise<ProcessingJob[]>;

  /**
   * Mark a job as completed.
   * @param jobId - Job ID
   */
  markCompleted(jobId: string): Promise<void>;

  /**
   * Mark a job as failed. Increments attempts.
   * If attempts >= maxAttempts → status = 'failed', else status = 'pending' (retry).
   * @param jobId - Job ID
   * @param error - Error message
   */
  markFailed(jobId: string, error: string): Promise<void>;

  /**
   * Reset all 'processing' jobs to 'pending'.
   * Called on startup to recover from crashes.
   */
  resetStaleJobs(): Promise<number>;

  /**
   * Get count of pending jobs.
   */
  countPending(): Promise<number>;
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Retry on failure | If attempts < maxAttempts → reset to pending | maxAttempts=0 → immediate fail |
| Crash recovery | On startup, reset processing → pending | No stale jobs → return 0 |
| Atomic take | takePending must atomically claim jobs | Concurrent callers must not get same job |
| Default max attempts | 3 attempts per job | Configurable per-queue |

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="job-queue" --bail`

---

### Task 2: SQLite Job Queue Implementation (RED → GREEN)

**Type**: RED (test) → GREEN (implement)
**File**: `packages/backend/src/infrastructure/queue/job-queue.service.ts`
**Test**: `packages/backend/src/infrastructure/queue/__tests__/job-queue.service.spec.ts`

**What to do**:
Implement `SqliteJobQueue` implementing `IJobQueue`, using Drizzle ORM against the existing `processingJobs` table. Test with in-memory SQLite.

**Key types**:
```typescript
@Injectable()
export class SqliteJobQueue implements IJobQueue {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: BetterSQLite3Database,
  ) {}
  // ... implement all IJobQueue methods
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Enqueue | INSERT with status='pending', attempts=0 | Duplicate invoiceId → allow (reprocessing) |
| TakePending | SELECT WHERE status='pending' LIMIT N, then UPDATE to 'processing' | N=0 → empty array |
| MarkCompleted | UPDATE status='completed', set completedAt | Job not found → throw |
| MarkFailed retry | INCREMENT attempts, if < max → 'pending' | already failed → no-op or throw |
| MarkFailed final | attempts >= max → status='failed' | Store lastError |
| ResetStale | UPDATE processing → pending, reset startedAt | Return count of reset jobs |

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="queue" --bail`

---

### Task 3: UploadBatchUseCase (RED → GREEN)

**Type**: RED (test) → GREEN (implement)
**File**: `packages/backend/src/application/upload/upload-batch.use-case.ts`
**Test**: `packages/backend/src/application/upload/__tests__/upload-batch.use-case.spec.ts`

**What to do**:
Implement the upload batch use case that:
1. Creates a Batch entity
2. For each file: validates (PDF, size ≤ 20MB), computes SHA-256 hash, checks for duplicates, saves to storage, creates Invoice entity
3. Saves batch and all invoices to repositories
4. Enqueues non-duplicate invoices for processing
5. Transitions batch to 'processing' status

**Key types**:
```typescript
export interface UploadBatchInput {
  readonly files: ReadonlyArray<UploadFileInput>;
  readonly uploadMode: string;
  readonly hintSchemaId?: string | null;
}

export interface UploadFileInput {
  readonly filename: string;
  readonly content: Buffer;
  readonly mimeType: string;
}

export interface UploadBatchOutput {
  readonly batchId: string;
  readonly totalFiles: number;
  readonly acceptedFiles: number;
  readonly rejectedFiles: number;
  readonly duplicateFiles: number;
  readonly results: ReadonlyArray<UploadFileResult>;
}

export interface UploadFileResult {
  readonly filename: string;
  readonly status: 'accepted' | 'rejected' | 'duplicate';
  readonly invoiceId?: string;
  readonly reason?: string;
  readonly duplicateOfId?: string;
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| PDF only | Check mimetype = 'application/pdf' | Non-PDF → reject with reason |
| Max size 20MB | Check content.length ≤ 20*1024*1024 | Oversized → reject with reason |
| Empty batch | At least 1 valid file required | All rejected → batch still created with error status |
| Dedup by hash | Lookup `findByFileHash(sha256(content))` | Hash match → mark as duplicate, link duplicateOf |
| File storage | Save to `uploads/{batchId}/{filename}` | Ensure unique filenames in batch |
| Enqueue | Only non-duplicate, non-rejected invoices | 0 accepted → don't transition batch to processing |

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="upload-batch" --bail`

---

### Task 4: ProcessInvoiceUseCase (RED → GREEN)

**Type**: RED (test) → GREEN (implement)
**File**: `packages/backend/src/application/processing/process-invoice.use-case.ts`
**Test**: `packages/backend/src/application/processing/__tests__/process-invoice.use-case.spec.ts`

**What to do**:
Implement the core processing pipeline use case that runs an invoice through all stages:

1. **Mark as processing** — transition invoice status
2. **Classify** — use FingerprintService with rules from DB, fallback to LLM classification via IOcrService
3. **Extract** — build prompt via PromptBuilder, call IOcrService.extract(), set extracted data on invoice
4. **Validate** — use ValidatorService against extracted data
5. **Score** — use ConfidenceCalculator to compute overall confidence
6. **Route** — based on confidence thresholds, route to auto_completed or needs_review

Each stage stores a trace entry. On error at any stage, mark invoice as error and stop.

**Key types**:
```typescript
export interface ProcessInvoiceInput {
  readonly invoiceId: string;
}

export interface ProcessInvoiceOutput {
  readonly invoiceId: string;
  readonly finalStatus: string;
  readonly overallConfidence: number | null;
  readonly stages: ReadonlyArray<StageResult>;
}

export interface StageResult {
  readonly stage: string;
  readonly status: 'completed' | 'failed' | 'skipped';
  readonly durationMs: number;
  readonly error?: string;
}
```

**Dependencies to inject**:
- `IInvoiceRepository` — load and save invoice
- `IBatchRepository` — update batch counters
- `ISchemaRepository` — load schema for classification
- `IFingerprintRuleRepository` — load rules for fingerprint
- `IFieldDefinitionRepository` — load fields for prompt building
- `IOcrService` — AI extraction
- `IFileStorage` — read PDF file for extraction
- `FingerprintService` — domain service (stateless, instantiate directly)
- `PromptBuilder` — domain service (stateless, instantiate directly)
- `ValidatorService` — domain service (stateless, instantiate directly)
- `ConfidenceCalculator` — domain service (stateless, instantiate directly)

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Classification | FingerprintService.classify() first; if no match, use IOcrService.extractAndClassify() | No schemas in DB → skip classification |
| Frontend hint | If batch has hintSchemaId, use as schema, method='frontend_hint' | Hint disagrees with fingerprint → lower confidence |
| Extraction | Read PDF base64 via IFileStorage, build prompt via PromptBuilder, call IOcrService.extract() | OCR service failure → mark error |
| Validation | ValidatorService.validate() returns errors; store as JSON | No errors = valid |
| Scoring | ConfidenceCalculator.calculate() with all inputs | Missing fields → handle gracefully |
| Routing - high | confidence ≥ 0.85 → auto_completed (from schema behavior config, default) | No behavior config → use default thresholds |
| Routing - medium | 0.60 ≤ confidence < 0.85 → needs_review | |
| Routing - low | confidence < 0.60 → needs_review (configurator level) | |
| Stage error | Any stage throws → mark invoice error, record trace, stop | Don't process remaining stages |
| Batch update | After processing, call batch.recordFileResult(success/fail) | |

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="process-invoice" --bail`

---

### Task 5: QueueWorkerService

**Type**: RED (test) → GREEN (implement)
**File**: `packages/backend/src/infrastructure/queue/queue-worker.service.ts`
**Test**: `packages/backend/src/infrastructure/queue/__tests__/queue-worker.service.spec.ts`

**What to do**:
Implement a NestJS lifecycle-aware worker that polls the queue and processes jobs.

**Key types**:
```typescript
@Injectable()
export class QueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private intervalRef: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    @Inject('IJobQueue') private readonly queue: IJobQueue,
    private readonly processInvoice: ProcessInvoiceUseCase,
  ) {}

  /**
   * Start polling on module init.
   */
  async onModuleInit(): Promise<void> {
    await this.queue.resetStaleJobs();
    this.startPolling();
  }

  /**
   * Stop polling on module destroy.
   */
  onModuleDestroy(): void {
    this.stopPolling();
  }

  private startPolling(intervalMs = 500): void { /* ... */ }
  private stopPolling(): void { /* ... */ }
  private async poll(): Promise<void> { /* take pending, process each */ }
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Poll interval | Every 500ms (configurable) | Skip if still processing previous batch |
| Concurrency | Take up to 5 jobs at a time (configurable) | 0 pending → no-op |
| Job processing | Call ProcessInvoiceUseCase.execute() per job | Success → markCompleted, failure → markFailed |
| Crash recovery | resetStaleJobs() on startup | |
| Graceful shutdown | Stop polling on destroy, wait for in-flight jobs | |

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="queue-worker" --bail`

---

### Task 6: NestJS Module Registration & Wiring

**Type**: GREEN (implement)
**File**: `packages/backend/src/infrastructure/queue/queue.module.ts` (NEW)
**File**: `packages/backend/src/application/application.module.ts` (NEW)
**File**: `packages/backend/src/app.module.ts` (MODIFY)

**What to do**:
1. Create `QueueModule` that provides `SqliteJobQueue` as `IJobQueue` and `QueueWorkerService`
2. Create `ApplicationModule` that provides `UploadBatchUseCase` and `ProcessInvoiceUseCase`
3. Import both modules in `AppModule`

**Key patterns**:
```typescript
// queue.module.ts
@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: 'IJobQueue', useClass: SqliteJobQueue },
    QueueWorkerService,
  ],
  exports: ['IJobQueue'],
})
export class QueueModule {}

// application.module.ts
@Module({
  imports: [DatabaseModule, QueueModule, AiModule, FileStorageModule],
  providers: [
    UploadBatchUseCase,
    ProcessInvoiceUseCase,
  ],
  exports: [UploadBatchUseCase, ProcessInvoiceUseCase],
})
export class ApplicationModule {}
```

**Verify**: `npx tsc --noEmit` (from `packages/backend/`)

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from packages/backend/ directory
npx tsc --noEmit

# Tests — from packages/backend/ directory (OR `npm test` from monorepo root)
npx jest --bail
# ⚠️ NEVER run `npx jest` from monorepo root — no jest config there

# Architecture (domain layer purity) — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
#   query ": any" in packages/backend/src/domain/  → expect 0 results
#   query "from.*infrastructure" (regex) in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] `IJobQueue` domain port interface exists in `domain/shared/job-queue.ts`
- [ ] `SqliteJobQueue` implementation exists with ≥8 test cases
- [ ] `UploadBatchUseCase` exists with ≥6 test cases (happy path + PDF validation + dedup + empty batch + max size + enqueue)
- [ ] `ProcessInvoiceUseCase` exists with ≥6 test cases (happy path + classification + extraction failure + validation errors + scoring + routing)
- [ ] `QueueWorkerService` exists with ≥4 test cases (startup reset + poll + completion + failure)
- [ ] All modules registered and wired in `AppModule`
- [ ] All tests pass (fresh `jest --bail` output)
- [ ] `tsc --noEmit` passes
- [ ] No architecture violations (drift-check clean)
- [ ] Session handoff updated
- [ ] Agent notes updated
- [ ] Total new tests: ≥30

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Job Queue + UploadBatch + ProcessInvoice use cases implemented
   - Found: {any surprises}
   - What's Next: "Session 8: Review/Schema/Mapping/Product/Export use cases"

2. Update `.context/agent-notes.md`:
   - Progress counters (use cases implemented, total tests)
   - Any new learned rules (queue patterns, use case testing patterns)

3. Update `tasks/progress.md`:
   - Steps 2.3 and 2.4a → ✅ Done

4. Create next session's action guide: `tasks/action-guides/s08-remaining-usecases.md`

**Next session depends on**: All use case and queue infrastructure being wired and tested.
