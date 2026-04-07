# Action Guide: Session 8 — Remaining Application Use Cases

> Created: 2026-04-07 | Created by: Antigravity (Developer)
> Phase Step: 2.4b (from master plan § 7 Session Plan)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 7 — Job Queue + Upload/Processing Use Cases → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → 322 passing
- [ ] Required files exist:
  - `packages/backend/src/application/upload/upload-batch.use-case.ts`
  - `packages/backend/src/application/processing/process-invoice.use-case.ts`
  - `packages/backend/src/application/application.module.ts`
  - `packages/backend/src/domain/invoice/invoice.entity.ts` — approve/reject/markAsEdited methods
  - `packages/backend/src/domain/schema/schema.entity.ts` — activate/deactivate, update
  - `packages/backend/src/domain/mapping/mapping.entity.ts` — create/confirm/deactivate
  - `packages/backend/src/domain/product/product.entity.ts` — sync/update
  - `packages/backend/src/domain/product/sync-conflict.entity.ts` — resolve methods
  - All 8 repository interfaces in `domain/`
  - All 8 repository implementations in `infrastructure/database/repositories/`
  - `packages/backend/src/domain/mapping/fuzzy-matcher.service.ts`
  - `packages/backend/src/domain/product/product-api.client.ts` (IProductApiClient)

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

Session 8 implements the remaining application-layer use cases that were deferred from Session 7:

1. **Review Use Cases** — Approve, reject, and edit invoices during human review (F04 — Validation & Review)
2. **Schema CRUD Use Cases** — Create, update, and test schema configurations (F05 — Schema Management)
3. **Mapping Use Cases** — Create mappings, bulk import, auto-learn from review actions (F07 — Product Mapping)
4. **Product Sync Use Cases** — Sync products from Viettel API, resolve conflicts (F06 — Product Master)
5. **Export Use Case** — Export processed invoices as CSV/JSON/XLSX (F08 — Export)

Reference: `tasks/01-business-spec.md` § F04, F05, F06, F07, F08

### Architecture Context

All use cases live in `packages/backend/src/application/`. Each use case:
- Is `@Injectable()` with `@Inject()` for repository/service DI
- Has a single `execute()` method with typed input/output
- Orchestrates domain entities and services — no business logic in use cases
- Domain services are stateless — instantiated directly, not via DI

Reference: `tasks/06-low-level-design.md` § 1 (application/ layer)

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| `invoices` | Review: approve/reject/edit status transitions |
| `schemas` | Schema CRUD: create/update/activate/deactivate |
| `schema_fingerprint_rules` | Schema CRUD: manage rules per schema |
| `schema_field_definitions` | Schema CRUD: manage field defs per schema |
| `product_mappings` | Mapping: create, bulk import, auto-learn |
| `viettel_products` | Product sync: upsert from API |
| `product_sync_conflicts` | Product sync: detect and resolve conflicts |

Reference: `tasks/04-database-design.md` § 2

### Data Flow

- Review use cases sit at the end of the processing pipeline (Stage 8: ACTION)
- Schema CRUD is a standalone management flow (Secondary Flow 1)
- Product sync is a periodic/manual background flow (Secondary Flow 4)
- Export is a post-processing output flow (Secondary Flow 3)

Reference: `tasks/05-data-flow-design.md` § 1 (Primary Flow — Stage 8), § 2-4 (Secondary Flows)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/use-case-implementation/skill.md` — Use case pattern (Injectable, Inject, execute())
2. `.agents/skills/bdd-test-writing/skill.md` — RED phase test structure
3. `.agents/skills/batch-implementation/skill.md` — Implementing 5+ use cases in one session
4. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-use-case.md` — step-by-step for use case implementation
- `.agents/workflows/quality-gate-pipeline.md` — pre-commit verification

### Relevant Learned Rules
- DI Token Convention: `{ provide: 'ISchemaRepository', useClass: SchemaRepositoryImpl }`
- Domain services are stateless: no constructor DI, receive all data as method parameters
- `FuzzyMatcher` uses `ProductData[]` plain interface
- Mock repositories in use case tests using Jest mocks — never use real DB
- **NEVER run `npx jest` from monorepo root** — run from `packages/backend/`
- **OS**: Windows + PowerShell. Bash `&&` does NOT work. Use `;` or separate commands
- `LineItemProps` requires `vatRate`, `vatAmount`, `totalWithVat` fields

---

## 3. Tasks (Ordered)

### Task 1: Review Use Cases (RED → GREEN)

#### Task 1a: ApproveInvoiceUseCase

**File**: `packages/backend/src/application/review/approve-invoice.use-case.ts`
**Test**: `packages/backend/src/application/review/__tests__/approve-invoice.use-case.spec.ts`

**What to do**:
Approve an invoice from `needs_review` status. Optionally update extracted data before approval.

**Key types**:
```typescript
export interface ApproveInvoiceInput {
  readonly invoiceId: string;
  readonly reviewerNote?: string;
}

export interface ApproveInvoiceOutput {
  readonly invoiceId: string;
  readonly previousStatus: string;
  readonly newStatus: string; // 'approved'
}
```

**Business rules**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Status guard | Only invoice with status 'needs_review' can be approved | Other statuses → throw |
| Transition | Call `invoice.approve()` → status becomes 'approved' | |
| Batch update | Increment batch completed counter | Batch already completed |
| Persist | Save invoice via repository | |

**Test cases** (≥4):
1. ✅ Happy: Invoice in needs_review → approved
2. ✅ Happy: Batch counters updated after approval
3. ❌ Error: Invoice not found → throws
4. ❌ Error: Invoice not in needs_review → throws

---

#### Task 1b: RejectInvoiceUseCase

**File**: `packages/backend/src/application/review/reject-invoice.use-case.ts`
**Test**: `packages/backend/src/application/review/__tests__/reject-invoice.use-case.spec.ts`

**What to do**:
Reject an invoice from `needs_review` status with a required reason.

**Key types**:
```typescript
export interface RejectInvoiceInput {
  readonly invoiceId: string;
  readonly reason: string;
}

export interface RejectInvoiceOutput {
  readonly invoiceId: string;
  readonly previousStatus: string;
  readonly newStatus: string; // 'rejected'
}
```

**Business rules**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Status guard | Only 'needs_review' can be rejected | |
| Reason required | reason must be non-empty string | Empty/whitespace |
| Batch update | Record failed file result on batch | |

**Test cases** (≥4):
1. ✅ Happy: Reject with reason → status = rejected
2. ✅ Happy: Batch updated
3. ❌ Error: Invoice not found → throws
4. ❌ Error: Reason empty → throws

---

#### Task 1c: EditInvoiceUseCase

**File**: `packages/backend/src/application/review/edit-invoice.use-case.ts`
**Test**: `packages/backend/src/application/review/__tests__/edit-invoice.use-case.spec.ts`

**What to do**:
Edit extracted data fields on an invoice in `needs_review` status. Does NOT change status.

**Key types**:
```typescript
export interface EditInvoiceInput {
  readonly invoiceId: string;
  readonly changes: Record<string, unknown>;
}

export interface EditInvoiceOutput {
  readonly invoiceId: string;
  readonly updatedFields: string[];
}
```

**Test cases** (≥3):
1. ✅ Happy: Edit fields on needs_review invoice
2. ❌ Error: Invoice not found → throws
3. ❌ Error: Invoice not in needs_review → throws

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="review" --bail`

---

### Task 2: Schema CRUD Use Cases (RED → GREEN)

#### Task 2a: CreateSchemaUseCase

**File**: `packages/backend/src/application/schema/create-schema.use-case.ts`
**Test**: `packages/backend/src/application/schema/__tests__/create-schema.use-case.spec.ts`

**What to do**:
Create a new schema with name, NCC info, optional fingerprint rules and field definitions.

**Key types**:
```typescript
export interface CreateSchemaInput {
  readonly name: string;
  readonly nccName: string;
  readonly nccTaxId: string;
  readonly description?: string;
  readonly promptTemplate?: string;
  readonly fingerprintRules?: Array<{
    ruleType: string;
    pattern: string;
    priority: number;
  }>;
  readonly fieldDefinitions?: Array<{
    fieldName: string;
    displayName: string;
    dataType: string;
    isRequired: boolean;
    extractionHint?: string;
  }>;
}

export interface CreateSchemaOutput {
  readonly schemaId: string;
  readonly name: string;
  readonly status: string; // 'draft'
  readonly rulesCreated: number;
  readonly fieldsCreated: number;
}
```

**Business rules**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Name unique | Check name doesn't already exist | |
| Initial status | Created as 'draft' | |
| Cascade create | Create rules and fields if provided | Empty arrays |
| NCC tax ID format | Validate MST format | |

**Test cases** (≥4):
1. ✅ Happy: Create schema with rules and fields
2. ✅ Happy: Create schema without optional items
3. ❌ Error: Duplicate name → throws
4. ❌ Error: Invalid tax ID format → throws

---

#### Task 2b: UpdateSchemaUseCase

**File**: `packages/backend/src/application/schema/update-schema.use-case.ts`
**Test**: `packages/backend/src/application/schema/__tests__/update-schema.use-case.spec.ts`

**What to do**:
Update schema properties, activate/deactivate.

**Test cases** (≥3):
1. ✅ Happy: Update name, description, template
2. ✅ Happy: Activate draft schema
3. ❌ Error: Schema not found → throws

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="schema" --bail`

---

### Task 3: Product Sync Use Case (RED → GREEN)

**File**: `packages/backend/src/application/product/sync-products.use-case.ts`
**Test**: `packages/backend/src/application/product/__tests__/sync-products.use-case.spec.ts`

**What to do**:
Fetch all products from Viettel API (via IProductApiClient), compare with local products, upsert new/changed, detect conflicts.

**Key types**:
```typescript
export interface SyncProductsOutput {
  readonly totalFetched: number;
  readonly created: number;
  readonly updated: number;
  readonly conflictsDetected: number;
}
```

**Business rules**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Fetch all | Use IProductApiClient.fetchAllProducts() | API failure → throw |
| Upsert | Match by productCode. Insert new, update existing | |
| Conflict detection | If local was manually edited and API data differs → create SyncConflict | No conflicts |
| Idempotent | Running sync twice with same data → no changes | |

**Test cases** (≥4):
1. ✅ Happy: Sync new products → created
2. ✅ Happy: Sync updated products → updated
3. ✅ Edge: Re-sync same data → no changes
4. ❌ Error: API failure → throws with message

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="sync-products" --bail`

---

### Task 4: Mapping Use Case (RED → GREEN)

**File**: `packages/backend/src/application/mapping/create-mapping.use-case.ts`
**Test**: `packages/backend/src/application/mapping/__tests__/create-mapping.use-case.spec.ts`

**What to do**:
Create a product mapping from partner name to Viettel product. Optionally use FuzzyMatcher for suggestions.

**Key types**:
```typescript
export interface CreateMappingInput {
  readonly schemaId: string;
  readonly partnerProductName: string;
  readonly viettelProductCode: string;
  readonly source: 'manual' | 'auto_learned' | 'bulk_import' | 'fuzzy_confirmed';
}

export interface CreateMappingOutput {
  readonly mappingId: string;
  readonly partnerProductName: string;
  readonly viettelProductCode: string;
  readonly status: string;
}
```

**Test cases** (≥3):
1. ✅ Happy: Create manual mapping
2. ✅ Happy: Create with auto_learned source
3. ❌ Error: Schema not found → throws

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="create-mapping" --bail`

---

### Task 5: Export Use Case (RED → GREEN)

**File**: `packages/backend/src/application/export/create-export.use-case.ts`
**Test**: `packages/backend/src/application/export/__tests__/create-export.use-case.spec.ts`

**What to do**:
Export approved invoices for a given batch or date range as CSV/JSON.

**Key types**:
```typescript
export interface CreateExportInput {
  readonly format: 'csv' | 'json';
  readonly batchId?: string;
  readonly schemaId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

export interface CreateExportOutput {
  readonly exportId: string;
  readonly filename: string;
  readonly recordCount: number;
  readonly fileSizeBytes: number;
}
```

**Business rules**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Filter | Apply batch/schema/date filters | No filters → export all approved |
| Format | CSV or JSON serialization | |
| Storage | Save to `exports/{exportId}.{format}` via IFileStorage | |
| Empty result | 0 records → still create file with headers/empty array | |

**Test cases** (≥4):
1. ✅ Happy: Export approved invoices as CSV
2. ✅ Happy: Export as JSON
3. ✅ Edge: No matching invoices → empty file
4. ❌ Error: Invalid format → throws

**Verify** (from `packages/backend/`): `npx jest --testPathPattern="create-export" --bail`

---

### Task 6: NestJS Module Registration

**Type**: GREEN (wiring)
**File**: `packages/backend/src/application/application.module.ts` (MODIFY)

**What to do**:
Add all new use cases to the ApplicationModule providers and exports.

```typescript
@Module({
  imports: [QueueModule],
  providers: [
    UploadBatchUseCase,
    ProcessInvoiceUseCase,
    ApproveInvoiceUseCase,
    RejectInvoiceUseCase,
    EditInvoiceUseCase,
    CreateSchemaUseCase,
    UpdateSchemaUseCase,
    SyncProductsUseCase,
    CreateMappingUseCase,
    CreateExportUseCase,
  ],
  exports: [/* all of the above */],
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

# Tests — from packages/backend/ directory
npx jest --bail
# ⚠️ NEVER run `npx jest` from monorepo root — no jest config there

# Architecture checks — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
#   query ": any" in packages/backend/src/domain/  → expect 0 results
#   query "from.*infrastructure" (regex) in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] ApproveInvoiceUseCase implemented with ≥4 test cases
- [ ] RejectInvoiceUseCase implemented with ≥4 test cases
- [ ] EditInvoiceUseCase implemented with ≥3 test cases
- [ ] CreateSchemaUseCase implemented with ≥4 test cases
- [ ] UpdateSchemaUseCase implemented with ≥3 test cases
- [ ] SyncProductsUseCase implemented with ≥4 test cases
- [ ] CreateMappingUseCase implemented with ≥3 test cases
- [ ] CreateExportUseCase implemented with ≥4 test cases
- [ ] All new use cases registered in ApplicationModule
- [ ] All 322+ previous tests still pass (no regressions)
- [ ] New use case tests all pass
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] 0 framework imports in domain layer (architecture preserved)
- [ ] Total new tests: ≥30
- [ ] Session handoff updated
- [ ] Agent notes updated
- [ ] Progress tracker updated (Step 2.4b → ✅ Done)
- [ ] Action guide for Session 9 created

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: 8 use cases (review×3, schema×2, product×1, mapping×1, export×1)
   - Found: {any surprises}
   - What's Next: "Session 9: Phase Step 3.1 — REST Controllers + DTOs + OpenAPI spec"

2. Update `.context/agent-notes.md`:
   - Progress counters (use cases → total, tests → total)
   - Any new learned rules

3. Update `tasks/progress.md`:
   - Mark Step 2.4b → ✅ Done

4. Create next session's action guide: `tasks/action-guides/s09-rest-controllers.md`

5. Commit: `feat: add remaining use cases (review, schema CRUD, product sync, mapping, export)`

**Next session depends on**: All use cases being available for controller wiring (Session 9 builds REST endpoints on top of these).
