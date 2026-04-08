# Action Guide: Session 19 — Duplicate Policy + Reprocess

> Created: 2026-04-08 | Created by: Antigravity
> Phase Step: 2.B.1 (Intake depth)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 18 (Notification bell + frontend wiring) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `invoice-tool/packages/backend/`) → 0 errors
- [ ] Tests passing: `npm test` (from `invoice-tool/`) → 455 tests all green
- [ ] Required files exist:
  - `invoice-tool/packages/backend/src/domain/invoice/invoice.entity.ts`
  - `invoice-tool/packages/backend/src/application/upload/upload-batch.use-case.ts`
  - `invoice-tool/packages/backend/src/interface/http/invoice.controller.ts`
  - `invoice-tool/packages/backend/src/interface/http/batch.controller.ts`
  - `invoice-tool/packages/frontend/src/app/upload/page.tsx`
  - `invoice-tool/packages/frontend/src/app/review/[id]/page.tsx`

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

The current duplicate handling is opaque: when a duplicate file is uploaded, it silently creates a blank Invoice row with status `duplicate` and no extracted data, confusing users who see it in the review queue. Users need: (1) the ability to choose a duplicate policy at upload time (`skip` | `process_anyway` | `flag_only`), (2) a reprocess action to re-run the pipeline on an already-processed invoice, and (3) the review queue should not show empty "duplicate" rows unless explicitly filtered.

Reference: `tasks/01-business-spec.md` § F11 — Duplicate Detection, § F01 — Upload & Preprocessing

### Architecture Context

This session touches **three bounded contexts**:
- **INTAKE**: `Batch` entity (no changes), `Invoice` entity (new `resumeForReprocess()` transition), `UploadBatchUseCase` (add `onDuplicate` input field)
- **PROCESSING**: New `ReprocessInvoiceUseCase` (re-runs pipeline on existing invoice)
- **REVIEW**: No domain changes; frontend-only ("Xử lý lại" button)

Layer map:
- **Domain**: `invoice.entity.ts` — add `resumeForReprocess()` method
- **Application**: `upload-batch.use-case.ts` — honour `onDuplicate` flag; new `reprocess-invoice.use-case.ts`
- **Interface**: `batch.controller.ts` + `create-batch.dto.ts` — add `onDuplicate` field; `invoice.controller.ts` — add `POST /api/invoices/:id/reprocess`
- **Frontend**: `upload/page.tsx` — duplicate policy radio; `review/[id]/page.tsx` — reprocess button

Reference: `tasks/06-low-level-design.md` § INTAKE context, PROCESSING context

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| `invoices` | Read/write — `resumeForReprocess()` changes status from terminal → `pending`, wipes extracted data |
| `batches` | Read — UploadBatch creates batch; no schema changes |
| `job_queue` | Write — reprocess enqueues invoice ID for re-processing |

Reference: `tasks/04-database-design.md` § invoices

### Data Flow

Upload flow with duplicate policy:
```
Upload files → hash each → findByFileHash →
  if duplicate:
    onDuplicate === 'skip' → mark duplicate (current behavior)
    onDuplicate === 'process_anyway' → DO NOT create new invoice, enqueue existing
    onDuplicate === 'flag_only' → mark duplicate, emit notification, do not enqueue
  else:
    save file → create invoice → enqueue
```

Reprocess flow:
```
POST /api/invoices/:id/reprocess →
  ReprocessInvoiceUseCase.execute() →
    invoice.resumeForReprocess() (status → pending, wipe extracted data) →
    invoiceRepo.save() →
    jobQueue.enqueue(invoice.id) →
    emit notification
```

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — for `resumeForReprocess()` entity transition
2. `.agents/skills/use-case-implementation/skill.md` — for `ReprocessInvoiceUseCase`
3. `.agents/skills/bdd-test-writing/skill.md` — for RED phase test patterns
4. `.agents/skills/api-controller/skill.md` — for reprocess endpoint
5. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-use-case.md` — main workflow for `ReprocessInvoiceUseCase`
- `.agents/workflows/quality-gate-pipeline.md` — verification

### Relevant Learned Rules
- `resumeForReprocess()` transition will break 3–5 existing tests in `invoice.entity.spec.ts` (from risk notes)
- Domain services are stateless — no constructor DI
- Use cases inject repos via `@Inject('ITokenName')`
- `@Optional()` for notification use case DI (may not be wired)
- Backend smoke test MANDATORY after DI changes (session 19 touches modules)
- `class-validator` decorators on DTOs for validation

---

## 3. Tasks (Ordered)

### Task 1: RED — Invoice entity `resumeForReprocess()` tests

**Type**: RED (test)
**File**: `invoice-tool/packages/backend/src/domain/invoice/__tests__/invoice.entity.spec.ts`

**What to do**:
Add test cases for a new `resumeForReprocess()` method:

1. **Happy path**: Invoice in `approved` → `resumeForReprocess()` → status becomes `pending`, extracted data wiped (invoiceNumber, sellerName, etc. → null), `processedAt` → null, `reviewedAt` → null, `reviewedBy` → null, `overallConfidence` → null, `duplicateOf` → null
2. **From rejected**: Invoice in `rejected` → `resumeForReprocess()` → works the same
3. **From error**: Invoice in `error` → `resumeForReprocess()` → works the same
4. **From duplicate**: Invoice in `duplicate` → `resumeForReprocess()` → works the same
5. **From pending**: Should throw `DomainError` — "Cannot reprocess invoice in pending status"
6. **From processing**: Should throw `DomainError` — "Cannot reprocess invoice in processing status"

**Key types**:
```typescript
// On Invoice class — new method signature:
resumeForReprocess(): void
// Allowed from: 'approved' | 'rejected' | 'error' | 'duplicate'
// NOT allowed from: 'pending' | 'processing' | 'extracted' | 'validated' | 'mapped' | 'needs_review'
```

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Terminal-state only | Only from `approved`, `rejected`, `error`, `duplicate` | What about `needs_review`? → throw (still being reviewed) |
| Wipes extraction data | All extracted fields → null, lineItems → [] | `overallConfidence`, `validationErrors`, `fieldConfidences` also null |
| Resets timestamps | `processedAt`, `reviewedAt`, `reviewedBy` → null | `updatedAt` refreshed |
| Clears duplicate link | `duplicateOf` → null | |

**Verify** (from `invoice-tool/packages/backend/`): `npx jest --testPathPattern="invoice.entity" --bail`

---

### Task 2: GREEN — Implement `resumeForReprocess()`

**Type**: GREEN (implement)
**File**: `invoice-tool/packages/backend/src/domain/invoice/invoice.entity.ts`

**What to do**:
Add `resumeForReprocess()` method to the `Invoice` class. Allowed from statuses: `approved`, `rejected`, `error`, `duplicate`. Throws `DomainError` for any other status.

```typescript
/**
 * Resume an invoice for reprocessing.
 * Resets to pending status and wipes all extracted data.
 * @throws DomainError if not in a terminal status
 */
resumeForReprocess(): void {
  const reprocessableStatuses: InvoiceStatus[] = ['approved', 'rejected', 'error', 'duplicate'];
  if (!reprocessableStatuses.includes(this.props.status)) {
    throw new DomainError(`Cannot reprocess invoice in "${this.props.status}" status`);
  }
  this.props = {
    ...this.props,
    status: 'pending',
    schemaId: null,
    classificationMethod: null,
    classificationConfidence: null,
    invoiceNumber: null,
    invoiceSymbol: null,
    invoiceDate: null,
    invoiceType: null,
    sellerName: null,
    sellerTaxId: null,
    buyerName: null,
    buyerTaxId: null,
    subtotal: null,
    vatRate: null,
    vatAmount: null,
    total: null,
    poNumber: null,
    lineItems: [],
    overallConfidence: null,
    ocrRawText: null,
    extractedRawJson: null,
    validationErrors: null,
    fieldConfidences: null,
    duplicateOf: null,
    processedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    updatedAt: new Date(),
  };
}
```

**Verify**: `npx jest --testPathPattern="invoice.entity" --bail` → all tests pass including new ones

---

### Task 3: RED — `ReprocessInvoiceUseCase` tests

**Type**: RED (test)
**File**: `invoice-tool/packages/backend/src/application/processing/__tests__/reprocess-invoice.use-case.spec.ts`

**What to do**:
Write BDD tests for the new `ReprocessInvoiceUseCase`:

1. **Happy path**: Given approved invoice → execute reprocess → invoice saved with `pending` status, job enqueued, notification created
2. **Invoice not found**: Given invalid ID → throws error
3. **Non-reprocessable status**: Given `pending` invoice → throws domain error
4. **Notification optional**: Given no notification use case → still works (does not crash)

**Key types**:
```typescript
export interface ReprocessInvoiceInput {
  readonly invoiceId: string;
}

export interface ReprocessInvoiceOutput {
  readonly invoiceId: string;
  readonly previousStatus: string;
  readonly newStatus: string;
}
```

---

### Task 4: GREEN — Implement `ReprocessInvoiceUseCase`

**Type**: GREEN (implement)  
**File**: `invoice-tool/packages/backend/src/application/processing/reprocess-invoice.use-case.ts`

**What to do**:
```typescript
@Injectable()
export class ReprocessInvoiceUseCase {
  constructor(
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IJobQueue') private readonly jobQueue: IJobQueue,
    @Optional() private readonly createNotification?: CreateNotificationUseCase,
  ) {}

  async execute(input: ReprocessInvoiceInput): Promise<ReprocessInvoiceOutput> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) throw new Error(`Invoice not found: ${input.invoiceId}`);

    const previousStatus = invoice.status;
    invoice.resumeForReprocess();
    await this.invoiceRepo.save(invoice);
    await this.jobQueue.enqueue(invoice.id);

    // Emit notification
    try {
      await this.createNotification?.execute({
        category: 'processing_started',
        title: 'Xử lý lại hóa đơn',
        message: `Hóa đơn "${invoice.originalFilename}" đang được xử lý lại.`,
        relatedEntityType: 'invoice',
        relatedEntityId: invoice.id,
      });
    } catch { /* non-critical */ }

    return {
      invoiceId: invoice.id,
      previousStatus,
      newStatus: invoice.status,
    };
  }
}
```

---

### Task 5: RED+GREEN — Update `UploadBatchUseCase` for `onDuplicate` flag

**Type**: RED then GREEN
**Test**: `invoice-tool/packages/backend/src/application/upload/__tests__/upload-batch.use-case.spec.ts`
**File**: `invoice-tool/packages/backend/src/application/upload/upload-batch.use-case.ts`

**What to do**:

1. Add `onDuplicate` to `UploadBatchInput`:
```typescript
export type DuplicatePolicy = 'skip' | 'process_anyway' | 'flag_only';

export interface UploadBatchInput {
  // ...existing fields...
  readonly onDuplicate?: DuplicatePolicy; // default 'skip'
}
```

2. In the duplicate-handling block of `execute()`:
   - `skip` (default, current behavior): create Invoice with duplicate status, no enqueue
   - `process_anyway`: DO NOT create a new Invoice. Enqueue the **existing** invoice for reprocessing (call `existingInvoice.resumeForReprocess()`, save, enqueue). Return result with status `accepted`, `duplicateOfId` still set for info.
   - `flag_only`: create Invoice with duplicate status (same as skip), emit notification, but do NOT auto-enqueue. Mark in result.

3. Add tests:
   - `process_anyway`: upload duplicate → existing invoice re-enqueued, no new invoice created
   - `flag_only`: upload duplicate → duplicate invoice created, notification sent, not enqueued

**Business rules**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Default policy | `onDuplicate` defaults to `'skip'` | Missing field → skip |
| process_anyway | Reuse existing invoice, enqueue it | Existing invoice may be in any terminal state |
| flag_only | Same as skip but with notification | Notification failure is non-critical |

---

### Task 6: Update DTOs and Controllers

**Type**: GREEN
**Files**:
- `invoice-tool/packages/backend/src/interface/http/dto/create-batch.dto.ts` — add `onDuplicate` field
- `invoice-tool/packages/backend/src/interface/http/batch.controller.ts` — pass `onDuplicate` to use case
- `invoice-tool/packages/backend/src/interface/http/invoice.controller.ts` — add `POST :id/reprocess`

**CreateBatchDto changes**:
```typescript
@ApiPropertyOptional({ 
  enum: ['skip', 'process_anyway', 'flag_only'], 
  description: 'Duplicate handling policy',
  default: 'skip' 
})
@IsOptional()
@IsEnum(['skip', 'process_anyway', 'flag_only'])
onDuplicate?: string;
```

**BatchController changes**:
Pass `onDuplicate: dto.onDuplicate` to `uploadBatchUseCase.execute()`.

**InvoiceController — new endpoint**:
```typescript
@Post(':id/reprocess')
@ApiOperation({ summary: 'Reprocess an invoice (re-run pipeline)' })
@ApiParam({ name: 'id', description: 'Invoice ID' })
@ApiResponse({ status: 200, type: InvoiceActionResponseDto })
async reprocess(@Param('id') id: string): Promise<InvoiceActionResponseDto> {
  const result = await this.reprocessUseCase.execute({ invoiceId: id });
  return {
    invoiceId: result.invoiceId,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
  };
}
```

**DI wiring**: Register `ReprocessInvoiceUseCase` in `ApplicationModule`. Inject into `InvoiceController`.

---

### Task 7: Frontend — Upload page duplicate policy radio

**Type**: GREEN
**File**: `invoice-tool/packages/frontend/src/app/upload/page.tsx`

**What to do**:
1. Add state: `const [onDuplicate, setOnDuplicate] = useState<string>('skip');`
2. Add radio group in the upload config section (after upload mode):
   - "Bỏ qua file trùng" (skip) — default
   - "Xử lý lại file trùng" (process_anyway)  
   - "Đánh dấu trùng, không xử lý" (flag_only)
3. Pass `onDuplicate` to `apiClient.uploadBatch()`
4. Update `api-client.ts` `uploadBatch` method to include `onDuplicate` in FormData
5. Add Vietnamese strings to `constants.ts`

---

### Task 8: Frontend — Review detail "Xử lý lại" button

**Type**: GREEN
**Files**: 
- `invoice-tool/packages/frontend/src/app/review/[id]/page.tsx`
- `invoice-tool/packages/frontend/src/lib/api-client.ts`

**What to do**:
1. Add `reprocessInvoice` method to API client:
```typescript
reprocessInvoice: (id: string) =>
  apiFetch<InvoiceActionResponse>(`/invoices/${id}/reprocess`, { method: 'POST' }),
```
2. In review detail page, show "🔄 Xử lý lại" button for invoices in terminal states (`approved`, `rejected`, `error`, `duplicate`):
```typescript
const REPROCESSABLE_STATUSES = ['approved', 'rejected', 'error', 'duplicate'];

{REPROCESSABLE_STATUSES.includes(invoice.status) && (
  <button onClick={handleReprocess} disabled={actionLoading}>
    🔄 Xử lý lại
  </button>
)}
```
3. `handleReprocess`: call API → show toast → re-fetch invoice (status should now be `pending`)

---

### Task 9: Register & Wire

**Type**: GREEN
**File**: `invoice-tool/packages/backend/src/application/application.module.ts`

**What to do**:
- Import and register `ReprocessInvoiceUseCase` as provider
- Add to exports if needed by InterfaceModule
- Update `InterfaceModule` if needed to inject `ReprocessInvoiceUseCase` into `InvoiceController`

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from invoice-tool/packages/backend/ directory
npx tsc --noEmit

# Tests — from invoice-tool/ directory
npm test
# ⚠️ NEVER run `npx jest` from monorepo root — no jest config there

# Frontend build — from invoice-tool/packages/frontend/ directory
npm run build

# Backend smoke test (DI changes made) — from project root
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# Architecture — use grep_search tool:
#   query "@nestjs" in invoice-tool/packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in invoice-tool/packages/backend/src/domain/  → expect 0 results
#   query ": any" in invoice-tool/packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations, tests ≥465.

---

## 5. Acceptance Criteria

- [ ] `Invoice.resumeForReprocess()` works from `approved`, `rejected`, `error`, `duplicate`; throws from other states
- [ ] `ReprocessInvoiceUseCase` re-enqueues invoice, resets to `pending`, creates notification
- [ ] `UploadBatchUseCase` honours `onDuplicate: 'skip' | 'process_anyway' | 'flag_only'`
- [ ] `POST /api/invoices/:id/reprocess` endpoint exists and works
- [ ] Upload page has duplicate policy radio buttons
- [ ] Review detail page has "Xử lý lại" button for terminal-state invoices
- [ ] All tests pass (fresh `jest --bail` output) — target ≥465
- [ ] `tsc --noEmit` passes
- [ ] Frontend `npm run build` passes
- [ ] Backend smoke test passes
- [ ] No architecture violations (drift-check clean)
- [ ] Session handoff updated
- [ ] Agent notes updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Duplicate policy + reprocess implemented (domain, application, interface, frontend)
   - Found: {any surprises}
   - What's Next: "Session 20: Invoice DTO expansion + file/trace endpoints" (Phase 2.C.1)

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Any new learned rules

3. Commit: `feat: duplicate policy + reprocess (session 19)`

**Next session depends on**: `ReprocessInvoiceUseCase` exists, `InvoiceResponseDto` unchanged (Session 20 will extend it)
