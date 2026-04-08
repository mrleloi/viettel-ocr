# Action Guide: Session 24 — Auto-create Schema + Create from Review

> Created: 2026-04-08 | Created by: Antigravity
> Phase Step: 2.D.3 (Schema Depth)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 23 (Schema Wizard Rewrite) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → 522 tests green
- [ ] Frontend build: `npm run build` (from `packages/frontend/`) → clean
- [ ] Required files exist:
  - `packages/backend/src/domain/batch/batch.entity.ts` — Batch entity
  - `packages/backend/src/application/processing/process-invoice.use-case.ts` — Pipeline
  - `packages/backend/src/application/schema/create-schema.use-case.ts` — Schema creation
  - `packages/backend/src/domain/notification/notification.entity.ts` — has `schema_suggestion` category
  - `packages/frontend/src/app/upload/page.tsx` — Upload page
  - `packages/frontend/src/app/review/[id]/page.tsx` — Review detail page

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
When the system encounters a brand-new invoice pattern that doesn't match any schema, it should optionally auto-create a draft schema from the extracted data (opt-in via upload checkbox). If auto-create is disabled, a `schema_suggestion` notification is emitted so the Configurator can review. From the review detail page, an operator should be able to create a new schema directly from an unmatched invoice.

Reference: `tasks/01-business-spec.md` § F03 (Classification), F05 (Schema Management)
Reference: `tasks/09-phase2-master-plan.md` § Session 24

### Architecture Context
- **Batch entity** (INTAKE context): Gets new `autoCreateSchemaOnNewPattern: boolean` field
- **ProcessInvoiceUseCase** (PROCESSING context): Gets new "maybe-create-schema" pipeline stage between SCORE and ROUTE
- **CreateSchemaUseCase** (SCHEMA context): Already exists, will be invoked programmatically
- **Notification** (NOTIFICATION context): `schema_suggestion` category already defined
- **Frontend**: Upload page checkbox + Review detail "Create Schema" button

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| `batches` | Add `auto_create_schema` column (boolean, default 0) |
| `schemas` | New rows created by auto-create flow |
| `field_definitions` | New rows created from extracted fields |
| `notifications` | New `schema_suggestion` rows when auto-create is OFF |

### Data Flow
```
Upload (checkbox ON) → Batch.autoCreateSchemaOnNewPattern = true
  → ProcessInvoice → classify → no match
    → maybe-create-schema stage
      → IF flag ON: CreateSchemaUseCase.execute() with draft status
      → IF flag OFF: CreateNotification(schema_suggestion)
    → route (needs_review)
```

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — Batch entity extension
2. `.agents/skills/pipeline-stage/skill.md` — New maybe-create-schema stage
3. `.agents/skills/bdd-test-writing/skill.md` — Test patterns
4. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-pipeline-stage.md` — Pipeline stage pattern

### Relevant Learned Rules
- `schema_suggestion` category already exists in `NOTIFICATION_CATEGORIES`
- `ALTER TABLE ADD COLUMN` needed for existing `batches` table
- DI-touching session → smoke test MANDATORY
- Domain services are stateless — no DI needed
- Use `@Optional()` for notification injection in use cases
- `BatchProps` lives in `packages/shared/src/domain/batch.types.ts`
- `initializeTables()` in `connection.ts` uses `CREATE TABLE IF NOT EXISTS` — won't add column

---

## 3. Tasks (Ordered)

### Task 1: Extend BatchProps (shared types)

**Type**: GREEN (implement)
**File**: `packages/shared/src/domain/batch.types.ts`

**What to do**:
Add `autoCreateSchemaOnNewPattern: boolean` to `BatchProps` interface.

```typescript
export interface BatchProps {
  // ... existing fields ...
  readonly autoCreateSchemaOnNewPattern: boolean; // NEW
}
```

---

### Task 2: Extend Batch entity

**Type**: RED then GREEN
**File**: `packages/backend/src/domain/batch/batch.entity.ts`
**Test**: `packages/backend/src/domain/batch/__tests__/batch.entity.spec.ts`

**What to do**:
1. Add `autoCreateSchemaOnNewPattern` to `CreateBatchProps` (optional, default false)
2. Update `Batch.create()` to set the new field (default `false`)
3. Add getter `get autoCreateSchemaOnNewPattern(): boolean`
4. Update `toProps()` (already returns spread of props)

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Default OFF | `autoCreateSchemaOnNewPattern` defaults to `false` | Omitted in input → false |
| Explicit set | Can be set to `true` via `CreateBatchProps` | — |

---

### Task 3: Update Batch DB schema + repository

**Type**: GREEN
**Files**:
- `packages/backend/src/infrastructure/database/schema.ts` — add column to `batches`
- `packages/backend/src/infrastructure/database/connection.ts` — add ALTER TABLE migration
- `packages/backend/src/infrastructure/database/repositories/batch.repository.impl.ts` — map field
- `packages/backend/src/infrastructure/database/__tests__/test-helpers.ts` — add column to test DDL

**What to do**:
1. Add `autoCreateSchema: integer('auto_create_schema', { mode: 'boolean' }).notNull().default(false)` to `batches` table
2. In `connection.ts` `initializeTables()`, add: `db.exec("ALTER TABLE batches ADD COLUMN auto_create_schema INTEGER NOT NULL DEFAULT 0")` wrapped in try/catch (column may already exist)
3. In `BatchRepositoryImpl.toDomain()`: map `row.autoCreateSchema` → `autoCreateSchemaOnNewPattern`
4. In `BatchRepositoryImpl.save()`: persist the field
5. Update test DDL in test-helpers.ts

---

### Task 4: Update UploadBatchInput + use case

**Type**: RED then GREEN
**File**: `packages/backend/src/application/upload/upload-batch.use-case.ts`
**Test**: `packages/backend/src/application/upload/__tests__/upload-batch.use-case.spec.ts`

**What to do**:
1. Add `autoCreateSchemaOnNewPattern?: boolean` to `UploadBatchInput`
2. Pass it through to `Batch.create()` call in `execute()`

---

### Task 5: Update Upload DTO (controller layer)

**Type**: GREEN
**File**: `packages/backend/src/interface/http/dto/upload-batch-input.dto.ts`

**What to do**:
Add `@ApiPropertyOptional()` + `@IsOptional()` + `@IsBoolean()` field `autoCreateSchemaOnNewPattern` to the input DTO.

---

### Task 6: Add "maybe-create-schema" stage to ProcessInvoiceUseCase

**Type**: RED then GREEN
**Files**:
- `packages/backend/src/application/processing/process-invoice.use-case.ts`
- `packages/backend/src/application/processing/__tests__/process-invoice.use-case.spec.ts`

**What to do**:
1. Inject `CreateSchemaUseCase` (via `@Optional() @Inject()`) and `CreateNotificationUseCase`
2. After SCORE stage and before ROUTE stage, add `STAGE: MAYBE_CREATE_SCHEMA`:
   - Check: `matchedSchemaId === null` (no schema matched)
   - Load batch via `batchRepo.findById(invoice.batchId)`
   - If `batch.autoCreateSchemaOnNewPattern === true`:
     - Call `CreateSchemaUseCase.execute()` with:
       - `name`: auto-generated from extracted seller name or "Auto-created Schema {timestamp}"
       - `nccName`: from extracted `sellerName` or "Unknown"
       - `nccTaxId`: from extracted `sellerTaxId` or generate placeholder
       - `description`: "Tự động tạo từ hóa đơn {invoiceId}"
       - No fingerprint rules, no field definitions (draft)
     - Set `invoice.schemaId` to the new schema ID
     - Log stage as completed
   - If `batch.autoCreateSchemaOnNewPattern === false` (or not set):
     - Emit `schema_suggestion` notification:
       - category: `'schema_suggestion'`
       - title: `'Phát hiện mẫu hóa đơn mới'`
       - message: `'Hóa đơn {invoiceNumber} không khớp mẫu nào. Vui lòng tạo mẫu mới.'`
       - relatedEntityType: `'invoice'`
       - relatedEntityId: `invoice.id`
     - Log stage as completed
   - If `matchedSchemaId !== null`: skip stage entirely (already classified)

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Only when unmatched | Stage only runs when `matchedSchemaId === null` | If schema already matched → skip entirely |
| Flag ON → auto-create | Creates draft schema using extracted data | Missing sellerName → use "Unknown" |
| Flag OFF → notify | Emits `schema_suggestion` notification | CreateNotification may be undefined (@Optional) |
| Auto-created = draft | Schema created with status `draft` (default) | Configurator must activate |
| Schema creation fails → fallback | If CreateSchemaUseCase throws (e.g. duplicate taxId), catch and log warning, continue pipeline | Don't fail the whole pipeline |

---

### Task 7: Frontend — Upload page checkbox

**Type**: GREEN
**File**: `packages/frontend/src/app/upload/page.tsx`
**Also**: `packages/frontend/src/lib/constants.ts`, `packages/frontend/src/lib/api-client.ts`

**What to do**:
1. Add to `constants.ts` VI.upload: `autoCreateSchema: 'Tự động tạo mẫu hóa đơn mới nếu phát hiện mẫu mới'`
2. Add checkbox state to upload page
3. Pass `autoCreateSchemaOnNewPattern` to API call
4. Update `apiClient.uploadBatch()` to accept the new field

---

### Task 8: Frontend — Review detail "Create Schema" button

**Type**: GREEN
**File**: `packages/frontend/src/app/review/[id]/page.tsx`
**Also**: `packages/frontend/src/app/globals.css`

**What to do**:
1. When invoice has `schemaId === null`, show "Tạo mẫu hóa đơn mới từ hóa đơn này" button
2. On click: call `apiClient.createSchema()` with data pre-filled from invoice (sellerName → nccName, sellerTaxId → nccTaxId)
3. On success: show toast + navigate to `/schemas/{newSchemaId}`
4. Add to `constants.ts` VI.review: `createSchemaFromInvoice: 'Tạo mẫu hóa đơn mới từ hóa đơn này'`

---

### Task 9: Register & Wire (NestJS DI)

**What to do**:
- `ProcessInvoiceUseCase` already depends on many services. The new dependency is `CreateSchemaUseCase` which is already provided by `ApplicationModule`. Use `@Optional()` injection.
- Verify `ApplicationModule` imports/exports are correct

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from packages/backend/ directory
npx tsc --noEmit

# Tests — from packages/backend/ directory
npx jest --bail

# Frontend build — from packages/frontend/ directory
npm run build

# Backend smoke test (DI-touching session!) — from project root
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# Architecture (domain work) — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] `BatchProps` has `autoCreateSchemaOnNewPattern: boolean` field
- [ ] Batch entity defaults `autoCreateSchemaOnNewPattern` to `false`
- [ ] `batches` DB table has `auto_create_schema` column
- [ ] `UploadBatchInput` accepts `autoCreateSchemaOnNewPattern` flag
- [ ] `ProcessInvoiceUseCase` has "maybe-create-schema" stage after SCORE
- [ ] When flag ON + no schema match → draft schema auto-created
- [ ] When flag OFF + no schema match → `schema_suggestion` notification emitted
- [ ] Upload page has checkbox for auto-create
- [ ] Review detail shows "Create schema" button when `schemaId === null`
- [ ] All tests pass (`jest --bail`)
- [ ] `tsc --noEmit` passes (backend)
- [ ] `npm run build` passes (frontend)
- [ ] Smoke test passes
- [ ] No architecture violations
- [ ] Session handoff updated
- [ ] Agent notes updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: auto-create-schema pipeline stage + upload checkbox + review create-schema button
   - Found: any surprises
   - What's Next: "Session 25: Product conflicts + mappings from review" (Phase 2.E)

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Any new learned rules

3. Commit: `feat: auto-create schema on new pattern detection + create from review`

**Next session depends on**: Sessions 20-24 complete, review detail page functional, schema CRUD working
