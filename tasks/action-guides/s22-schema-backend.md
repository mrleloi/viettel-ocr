# Action Guide: Session 22 — Field-def / Fingerprint CRUD + Schema Preview

> Created: 2026-04-08 (retroactive) | Created by: Antigravity (Claude Opus 4.6)
> Phase Step: 2.D.1 (Schema Depth — Backend)
> Target Agent: Developer
> Note: This guide was created **retroactively** after Session 22 ran without one (violation of Rule 18-19). It serves as the verification baseline for post-hoc review.

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 21 (PDF viewer + verification UI + batch detail) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `invoice-tool/packages/backend/`) → 0 errors
- [ ] Tests passing: `npm test` (from `invoice-tool/`) → ≥498 tests all green
- [ ] Frontend build: `npx next build` (from `invoice-tool/packages/frontend/`) → green
- [ ] Required files exist:
  - `invoice-tool/packages/backend/src/domain/schema/field-definition.entity.ts` (FieldDefinition entity)
  - `invoice-tool/packages/backend/src/domain/schema/fingerprint-rule.entity.ts` (FingerprintRule entity)
  - `invoice-tool/packages/backend/src/domain/schema/field-definition.repository.ts` (IFieldDefinitionRepository)
  - `invoice-tool/packages/backend/src/domain/schema/fingerprint-rule.repository.ts` (IFingerprintRuleRepository)
  - `invoice-tool/packages/backend/src/interface/http/schema.controller.ts` (SchemaController)
  - `invoice-tool/packages/backend/src/infrastructure/database/schema.ts` (has `field_definitions` + `fingerprint_rules` tables with `output_key` column)

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
Schema management requires full CRUD for field definitions (what fields to extract from an invoice) and fingerprint rules (how to classify invoices to match this schema). Additionally, Configurators need a "preview" endpoint that takes a sample PDF and runs OCR extraction using the schema's field list — without creating an Invoice or Batch — to test if the schema works before activating it.

Reference: `tasks/01-business-spec.md` § F05 (Schema Management), § F03 (Classification & Fingerprinting)
Reference: `tasks/09-phase2-master-plan.md` § Issue 7, Issue 9

### Architecture Context
This session crosses multiple layers within the SCHEMA MANAGEMENT bounded context:
- **Domain**: FieldDefinition and FingerprintRule entities already exist; add `outputKey` field to FieldDefinition if not present
- **Application**: New `PreviewSchemaExtractionUseCase` — runs OCR on a PDF using the schema's field list
- **Interface**: Add CRUD endpoints for fields/rules under `SchemaController`, add `POST /api/schemas/:id/preview`
- **Infrastructure**: Field/rule repos already exist; may need minor extensions

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| `field_definitions` | CRUD target — fieldName, displayName, dataType, isRequired, outputKey, extractionHint, sortOrder |
| `fingerprint_rules` | CRUD target — ruleType, pattern, priority, isActive |
| `schemas` | Read-only in this session — needed for preview (schema's promptTemplate, nccName) |

### Data Flow
- CRUD: `Controller endpoint` → validate DTO → `Repository.save/find/delete()` → response DTO
- Preview: `POST /api/schemas/:id/preview` (multipart PDF) → `PreviewSchemaExtractionUseCase.execute()` → load schema + fields → build prompt via `PromptBuilder` → call `IOcrService.extractInvoiceData()` → return extracted fields + confidences → **no Invoice/Batch created**

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/api-controller/skill.md` — NestJS controllers with Swagger decorators
2. `.agents/skills/use-case-implementation/skill.md` — PreviewSchemaExtractionUseCase
3. `.agents/skills/bdd-test-writing/skill.md` — Tests for CRUD endpoints + preview
4. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-api.md` — for the CRUD + preview endpoints
- `.agents/workflows/implement-use-case.md` — for the preview use case
- `.agents/workflows/quality-gate-pipeline.md` — final verification

### Relevant Learned Rules
- `outputKey` column already exists in `field_definitions` table from Phase 1 scaffolding — no ALTER TABLE needed
- File upload inline type: `{ originalname: string; buffer: Buffer; mimetype: string }` avoids @types/multer issues
- Preview-style POST: No resource created → use `@HttpCode(200)` to avoid NestJS default 201
- Domain services are stateless — PromptBuilder receives data as method params, not injected
- Smoke test MANDATORY — this session touches `@Inject()` decorators and endpoints

---

## 3. Tasks (Ordered)

### Task 1: Fix Existing Schema Controller Tests (if broken)

**Type**: RED/GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/__tests__/schema.controller.spec.ts`

**What to do**:
1. Run existing schema controller tests first
2. Fix any broken tests (e.g., mock providers may be incomplete after Session 20-21 changes)
3. Ensure all existing tests pass before adding new ones

**Verify**: `npx jest --testPathPattern="schema.controller" --bail`

---

### Task 2: Add Field Definition CRUD Endpoints

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/schema.controller.ts`
**DTOs**: `invoice-tool/packages/backend/src/interface/http/dto/field-definition.dto.ts` (NEW)
**Test**: `invoice-tool/packages/backend/src/interface/http/__tests__/schema.controller.spec.ts`

**What to do**:
1. Create DTOs: `CreateFieldDefinitionDto`, `UpdateFieldDefinitionDto`, `FieldDefinitionResponseDto`
2. Add endpoints to `SchemaController`:
   - `GET /api/schemas/:id/fields` → list all field definitions for schema
   - `POST /api/schemas/:id/fields` → create a field definition
   - `PUT /api/schemas/:id/fields/:fieldId` → update a field definition
   - `DELETE /api/schemas/:id/fields/:fieldId` → delete a field definition
3. Write tests for each endpoint (at least 4 tests: list, create, update, delete)

**Key DTOs**:
```typescript
class CreateFieldDefinitionDto {
  @IsString() fieldName!: string;
  @IsString() displayName!: string;
  @IsIn(['string', 'integer', 'number', 'date', 'boolean']) dataType!: string;
  @IsBoolean() @IsOptional() isRequired?: boolean;
  @IsString() @IsOptional() validationRules?: string;
  @IsString() @IsOptional() extractionHint?: string;
  @IsString() @IsOptional() outputKey?: string;
  @IsInt() @IsOptional() sortOrder?: number;
}
```

---

### Task 3: Add Fingerprint Rule CRUD Endpoints

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/schema.controller.ts`
**DTOs**: `invoice-tool/packages/backend/src/interface/http/dto/fingerprint-rule.dto.ts` (NEW)
**Test**: `invoice-tool/packages/backend/src/interface/http/__tests__/schema.controller.spec.ts`

**What to do**:
1. Create DTOs: `CreateFingerprintRuleDto`, `UpdateFingerprintRuleDto`, `FingerprintRuleResponseDto`
2. Add endpoints:
   - `GET /api/schemas/:id/fingerprint-rules` → list all rules for schema
   - `POST /api/schemas/:id/fingerprint-rules` → create a rule
   - `PUT /api/schemas/:id/fingerprint-rules/:ruleId` → update a rule
   - `DELETE /api/schemas/:id/fingerprint-rules/:ruleId` → delete a rule
3. Write tests (at least 4 tests)

---

### Task 4: Create PreviewSchemaExtractionUseCase

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/application/schema/preview-schema-extraction.use-case.ts` (NEW)
**Test**: `invoice-tool/packages/backend/src/application/schema/__tests__/preview-schema-extraction.use-case.spec.ts` (NEW)

**What to do**:
1. Inject: `ISchemaRepository`, `IFieldDefinitionRepository`, `IOcrService`
2. Input: `{ schemaId: string; fileBuffer: Buffer; filename: string }`
3. Logic:
   - Load schema by ID (throw if not found)
   - Load field definitions for schema
   - Build extraction prompt using `PromptBuilder` (stateless — instantiate directly)
   - Call `IOcrService.extractInvoiceData()` with prompt + file buffer
   - Return `{ schemaId, schemaName, extractedFields, rawText, fieldConfidences }`
4. Key: **NO Invoice/Batch created** — this is a read-only preview operation
5. Write BDD tests with mocked repos + OCR service

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Schema must exist | throw NotFoundException if not found | Invalid ID |
| File required | throw BadRequestException if buffer empty | null/empty buffer |
| No side effects | Don't create Invoice, Batch, or ProcessingTrace | — |
| Return field confidences | Parse from OCR response | Missing confidences |

---

### Task 5: Add Preview Endpoint

**Type**: RED then GREEN
**File**: `invoice-tool/packages/backend/src/interface/http/schema.controller.ts`
**Test**: `invoice-tool/packages/backend/src/interface/http/__tests__/schema.controller.spec.ts`

**What to do**:
1. Add `POST /api/schemas/:id/preview` endpoint
2. Accept multipart form data with a single `file` field
3. Call `PreviewSchemaExtractionUseCase.execute()`
4. Use `@HttpCode(200)` since no resource is created
5. Write tests (at least 2: success, schema not found)

```typescript
@Post(':id/preview')
@HttpCode(200)
@ApiOperation({ summary: 'Preview schema extraction on a sample PDF' })
@UseInterceptors(FileInterceptor('file'))
async previewExtraction(
  @Param('id') id: string,
  @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string },
): Promise<PreviewSchemaResponseDto> {
  return this.previewUseCase.execute({
    schemaId: id,
    fileBuffer: file.buffer,
    filename: file.originalname,
  });
}
```

---

### Task 6: Register & Wire NestJS Modules

**Type**: GREEN
**Files**:
- `invoice-tool/packages/backend/src/application/application.module.ts` — register PreviewSchemaExtractionUseCase
- `invoice-tool/packages/backend/src/interface/interface.module.ts` — ensure AiModule imported for IOcrService access

**What to do**:
1. Add `PreviewSchemaExtractionUseCase` to `ApplicationModule` providers
2. Ensure `InterfaceModule` imports `AiModule` (or verify it's already accessible)
3. Run smoke test after wiring

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from invoice-tool/packages/backend/ directory
npx tsc --noEmit

# Tests — from invoice-tool/ directory
npm test
# Expect: ≥510 tests passing (base 498 + ~16 new field/rule/preview tests)

# Backend smoke test (MANDATORY — new @Inject + new use case provider) — from project root
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# Frontend build — from invoice-tool/packages/frontend/ (should still pass — no frontend changes)
npx next build

# Architecture (domain purity) — use grep_search tool:
#   query "@nestjs" in invoice-tool/packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in invoice-tool/packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] `GET /api/schemas/:id/fields` returns field definitions for a schema
- [ ] `POST /api/schemas/:id/fields` creates a field definition with all properties
- [ ] `PUT /api/schemas/:id/fields/:fieldId` updates a field definition
- [ ] `DELETE /api/schemas/:id/fields/:fieldId` deletes a field definition
- [ ] `GET /api/schemas/:id/fingerprint-rules` returns fingerprint rules for a schema
- [ ] `POST /api/schemas/:id/fingerprint-rules` creates a fingerprint rule
- [ ] `PUT /api/schemas/:id/fingerprint-rules/:ruleId` updates a fingerprint rule
- [ ] `DELETE /api/schemas/:id/fingerprint-rules/:ruleId` deletes a fingerprint rule
- [ ] `POST /api/schemas/:id/preview` runs OCR extraction on a sample PDF and returns results
- [ ] Preview endpoint uses `@HttpCode(200)` (not 201)
- [ ] Preview does NOT create Invoice, Batch, or ProcessingTrace records
- [ ] `PreviewSchemaExtractionUseCase` has BDD tests (happy path + edge cases)
- [ ] All CRUD endpoints have controller tests
- [ ] All tests pass (target: ≥510 tests)
- [ ] `tsc --noEmit` passes (backend)
- [ ] Smoke test passes
- [ ] No architecture violations (domain layer pure)
- [ ] Session handoff updated
- [ ] `tasks/progress.md` updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Field/rule CRUD endpoints, PreviewSchemaExtractionUseCase, preview endpoint
   - Found: {any surprises — e.g., `outputKey` already existed, file upload type pattern}
   - What's Next: "Session 23: 7-step schema wizard rewrite" (Phase 2.D.2)

2. Update `.context/agent-notes.md`:
   - Test count update (target: ≥510)
   - Any new learned rules about CRUD patterns or preview design

3. Update `tasks/progress.md`:
   - Mark 2.D.1 as ✅ Done with session 22 and test count

4. Commit: `feat: field-def/fingerprint CRUD endpoints + preview schema extraction use case`

**Next session depends on**: All field/rule CRUD endpoints + preview endpoint must be working — Session 23 builds the 7-step wizard frontend that calls these APIs.
