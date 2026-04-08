# Action Guide: Session 23 — Schema Wizard Rewrite

> Created: 2026-04-08 | Created by: Claude Code (Architect)
> Phase Step: 2.D.2 — Schema wizard rewrite
> Target Agent: Developer (Antigravity)

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Session 22 complete: `PreviewSchemaExtractionUseCase` exists at `application/schema/preview-schema-extraction.use-case.ts`
- [ ] Backend endpoints exist: `GET/POST/PUT/DELETE /api/schemas/:id/fields` and `/fingerprint-rules` and `POST /api/schemas/:id/preview`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npm test` (from monorepo root `invoice-tool/`) → 522 tests green
- [ ] Frontend build clean: `npm run typecheck` (from `packages/frontend/`) → 0 errors

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
F05 §3.5 describes a **7-step schema wizard**: Basic Info → Upload Samples → Interactive Field Mapper → Fingerprint Setup → Behavior Config → Test Run → Activate. The current wizard has only 2 steps (Basic Info + Review). Configurator cannot create a working schema end-to-end.

Reference: `tasks/01-business-spec.md` § F05 — Schema Management

### Architecture Context
Session 23 is frontend-only. All backend API endpoints were created in session 22:
- `GET /api/schemas/:id/fields` — list fields
- `POST /api/schemas/:id/fields` — create field
- `PUT /api/schemas/:id/fields/:fieldId` — update field
- `DELETE /api/schemas/:id/fields/:fieldId` — delete field
- `GET /api/schemas/:id/fingerprint-rules` — list rules
- `POST /api/schemas/:id/fingerprint-rules` — create rule
- `PUT /api/schemas/:id/fingerprint-rules/:ruleId` — update rule
- `DELETE /api/schemas/:id/fingerprint-rules/:ruleId` — delete rule
- `POST /api/schemas/:id/preview` — preview extraction (multipart PDF upload)

Reference: `tasks/06-low-level-design.md` § Schema context

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| `schemas` | Create/update schema (step 1 + step 7) |
| `field_definitions` | CRUD in step 3 (Field Mapper) |
| `fingerprint_rules` | CRUD in step 4 (Fingerprint Setup) |

Reference: `tasks/04-database-design.md` § Schema Management

### Data Flow
Wizard → `POST /api/schemas` (step 1) → get schema ID → `POST /api/schemas/:id/fields` (step 3) → `POST /api/schemas/:id/fingerprint-rules` (step 4) → `POST /api/schemas/:id/preview` (step 6 test run) → `PUT /api/schemas/:id` with `statusAction: 'activate'` (step 7)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/frontend-component/skill.md` — page + component patterns
2. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-page.md` — page implementation pattern

### Relevant Learned Rules

**Frontend:**
- `npm run typecheck` NOT `npm run build` for fast TS check (from `packages/frontend/`)
- All Vietnamese text via `src/lib/constants.ts` `VI` constant — NO hardcoded Vietnamese in JSX
- No React Query yet — use `useState` + `useEffect` + `useCallback` pattern
- File uploads: `<input type="file" accept=".pdf">` → `FileReader` API → multipart `FormData`
- `@theme inline` CSS warning in IDE is a false positive (Tailwind 4)

**API client:**
- Typed `apiClient` at `packages/frontend/src/lib/api-client.ts`
- Add new methods for field CRUD, fingerprint rule CRUD, and preview endpoints
- Preview uses `multipart/form-data` — use `fetch` with `FormData`, NOT JSON

**Architecture:**
- `app/` directory for pages (Next.js App Router)
- Components receive props only — no direct API calls inside shared components
- Client Components (`'use client'`) only for interactivity
- Keep page-specific CSS sections clearly separated with comment headers

**OS:**
- Windows 11 / PowerShell — bash `&&` does NOT work in PowerShell

---

## 3. Tasks (Ordered)

### Task 1: Update API client with new methods

**Type**: GREEN (implement)
**File**: `packages/frontend/src/lib/api-client.ts`

**What to do**: Add typed methods for all session-22 endpoints:

```typescript
// Field Definitions
listFields(schemaId: string): Promise<FieldDefinitionResponse[]>
createField(schemaId: string, data: CreateFieldInput): Promise<FieldDefinitionResponse>
updateField(schemaId: string, fieldId: string, data: UpdateFieldInput): Promise<FieldDefinitionResponse>
deleteField(schemaId: string, fieldId: string): Promise<{ deleted: boolean }>

// Fingerprint Rules  
listFingerprintRules(schemaId: string): Promise<FingerprintRuleResponse[]>
createFingerprintRule(schemaId: string, data: CreateRuleInput): Promise<FingerprintRuleResponse>
updateFingerprintRule(schemaId: string, ruleId: string, data: UpdateRuleInput): Promise<FingerprintRuleResponse>
deleteFingerprintRule(schemaId: string, ruleId: string): Promise<{ deleted: boolean }>

// Preview
previewSchemaExtraction(schemaId: string, file: File): Promise<PreviewSchemaResponse>
```

**Key types to add** (inline in api-client.ts):
```typescript
interface FieldDefinitionResponse {
  id: string;
  schemaId: string;
  fieldName: string;
  displayName: string;
  dataType: 'string' | 'integer' | 'number' | 'date' | 'boolean';
  isRequired: boolean;
  validationRules: string | null;
  extractionHint: string | null;
  outputKey: string | null;
  sortOrder: number;
}

interface FingerprintRuleResponse {
  id: string;
  schemaId: string;
  ruleType: 'mst_exact' | 'keyword' | 'symbol_regex' | 'custom';
  pattern: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

interface PreviewSchemaResponse {
  schemaId: string;
  schemaName: string;
  extractedFields: Record<string, unknown>;
  rawText: string;
  fieldConfidences: Record<string, number>;
}
```

**Preview endpoint** uses multipart — special implementation:
```typescript
async previewSchemaExtraction(schemaId: string, file: File): Promise<PreviewSchemaResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api/schemas/${schemaId}/preview`, {
    method: 'POST',
    body: formData,  // NO Content-Type header — browser sets multipart boundary
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Preview failed');
  }
  return response.json() as Promise<PreviewSchemaResponse>;
}
```

**Verify**: `npm run typecheck` from `packages/frontend/` → 0 errors

---

### Task 2: Add Vietnamese wizard labels to constants

**Type**: GREEN (implement)
**File**: `packages/frontend/src/lib/constants.ts`

**What to do**: Add wizard step names and labels to the `VI` constant:
```typescript
// In VI object:
SCHEMA_WIZARD_STEPS: [
  'Thông tin cơ bản',       // step 1
  'Tải mẫu hóa đơn',       // step 2
  'Cấu hình trường dữ liệu', // step 3
  'Cấu hình fingerprint',   // step 4
  'Cấu hình hành vi',       // step 5
  'Chạy thử',               // step 6
  'Kích hoạt',              // step 7
],
FIELD_DATA_TYPES: {
  string: 'Văn bản',
  integer: 'Số nguyên',
  number: 'Số thực',
  date: 'Ngày tháng',
  boolean: 'Đúng/Sai',
},
FINGERPRINT_RULE_TYPES: {
  mst_exact: 'Khớp MST chính xác',
  keyword: 'Từ khóa',
  symbol_regex: 'Ký hiệu (Regex)',
  custom: 'Tùy chỉnh',
},
```

---

### Task 3: Rewrite schema wizard (app/schemas/new/page.tsx)

**Type**: GREEN (implement)
**File**: `packages/frontend/src/app/schemas/new/page.tsx`

**What to do**: Rewrite as a 7-step wizard. This is the main implementation.

**Step-by-step breakdown:**

**Step 1 — Basic Info:**
- Form: name, nccName, nccTaxId, description, promptTemplate (textarea)
- On "Next": `POST /api/schemas` → get `schemaId`
- If schema already exists (400 error): show error, stay on step 1

**Step 2 — Upload Samples:**
- File input (`accept=".pdf"`) for uploading 1-3 sample PDFs
- Files stored in component state (not uploaded yet — upload happens in step 6)
- "Skip" button allowed (not all schemas need preview)
- Simple: just file picker + list of selected files

**Step 3 — Field Mapper:**
- Shows current fields (fetch `GET /api/schemas/:id/fields`)
- Table with columns: fieldName, displayName, dataType, isRequired, outputKey, extractionHint
- "Add field" button → inline row form (no dialog needed)
- Each row has "Delete" button → `DELETE /api/schemas/:id/fields/:fieldId`
- "Save" on each row → `POST` (new) or `PUT` (existing)
- Reorder by drag or up/down arrows (sort order update via PUT)

**Step 4 — Fingerprint Setup:**
- Shows current rules (fetch `GET /api/schemas/:id/fingerprint-rules`)
- List: ruleType select + pattern input + priority number + delete button
- "Add rule" button → new empty row
- Save changes via `POST` / `PUT` / `DELETE`
- Rule types: mst_exact, keyword, symbol_regex, custom

**Step 5 — Behavior Config:**
- 3 threshold sliders or inputs:
  - Auto-approve threshold (default: 85%)
  - Review threshold (default: 60%)
  - Auto-reject threshold (default: 40%)
- Stored in component state, saved to schema via `PUT /api/schemas/:id` (`behaviorConfig` JSON field) when advancing to step 6

**Step 6 — Test Run:**
- If sample files were uploaded in step 2: show "Run preview" button for each file
- On run: `POST /api/schemas/:id/preview` with file → show results table
  - Column per extracted field + confidence score (color-coded: ≥80% green, ≥60% amber, <60% red)
- If no sample files: show message "No sample uploaded — skip to activate"
- "Skip" allowed

**Step 7 — Activate:**
- Summary: schema name, NCC, field count, rule count
- Two buttons: "Activate now" → `PUT /api/schemas/:id` with `{ statusAction: 'activate' }` then navigate to `/schemas`
- "Save as draft" → just navigate to `/schemas`

**State management pattern:**
```typescript
interface WizardState {
  step: number;
  schemaId: string | null;
  sampleFiles: File[];
  previewResults: Array<{ filename: string; result: PreviewSchemaResponse | null; loading: boolean }>;
}
```

**Navigation:**
- Step progress bar at top (7 dots or numbered steps)
- "Back" / "Next" buttons at bottom
- Step 1 cannot go back
- Steps 2-6 can go back (but won't re-run API calls)

**Verify**: `npm run typecheck` → 0 errors, `npm run build` → no warnings

---

### Task 4: Update schema detail page (app/schemas/[id]/page.tsx)

**Type**: GREEN (implement)
**File**: `packages/frontend/src/app/schemas/[id]/page.tsx`

**What to do**: Add "Fields" and "Rules" tabs/sections to the existing schema detail page.

The current detail page shows basic schema info + inline editing of name/desc/promptTemplate. Add two new sections:

**Fields section:**
- `GET /api/schemas/:id/fields` on page load
- Table: fieldName, displayName, dataType, isRequired, outputKey
- "Add field" button → opens simple inline form
- Each row: edit icon → inline edit, delete icon → confirm + `DELETE`

**Rules section:**
- `GET /api/schemas/:id/fingerprint-rules` on page load
- List: ruleType badge, pattern, priority number, active toggle
- "Add rule" button → inline form
- Each row: edit, delete

This doesn't need to be as rich as the wizard — just functional CRUD for Configurators who need to tweak an existing schema.

**Verify**: `npm run typecheck` → 0 errors

---

### Task 5: Register types in api-client.ts index (if needed)

Verify the API client is exporting all new types needed by frontend pages. Check if `api-client.ts` has a consistent export pattern.

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# TypeScript check — from packages/frontend/ directory
npm run typecheck

# Frontend build — catch SSR / import errors
npm run build

# Backend still passes (no regressions from frontend changes)
# From invoice-tool/ monorepo root:
npm test
# Expected: 522 tests passing
```

**Pass criteria**: ALL commands succeed, 0 TypeScript errors.

---

## 5. Acceptance Criteria

- [ ] Schema wizard has 7 visible steps with progress indicator
- [ ] Step 1: creates schema via `POST /api/schemas`, stores `schemaId` for subsequent steps
- [ ] Step 2: file picker for sample PDFs, files held in state
- [ ] Step 3: field table with add/edit/delete (live sync to `GET/POST/PUT/DELETE /api/schemas/:id/fields`)
- [ ] Step 4: rule list with add/edit/delete (live sync to `GET/POST/PUT/DELETE /api/schemas/:id/fingerprint-rules`)
- [ ] Step 5: behavior threshold config stored and saved
- [ ] Step 6: if sample files → preview runs via `POST /api/schemas/:id/preview`, results shown with confidence coloring
- [ ] Step 7: "Activate now" calls `PUT /api/schemas/:id` + navigates to `/schemas`
- [ ] Schema detail page (`/schemas/:id`) has functional field + rule CRUD sections
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run build` → clean build
- [ ] `npm test` → still 522 passing (backend unchanged)
- [ ] All Vietnamese text via `VI` constants, no hardcoded strings
- [ ] Session handoff updated
- [ ] `tasks/progress.md` updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: 7-step schema wizard, schema detail field/rule CRUD
   - Found: any surprises
   - What's Next: "Session 24: Auto-create-schema + create-from-review" (from master plan)

2. Update `.context/agent-notes.md`:
   - Progress counters (tests count unchanged — frontend has no tests)
   - Any new frontend patterns discovered

3. Commit: `feat: 7-step schema wizard with field mapper and fingerprint rule editor`

**Next session depends on**:
- Session 24 adds "Tạo mẫu hóa đơn mới từ hóa đơn này" button on review detail — needs schema wizard to exist
- Session 24 adds `autoCreateSchemaOnNewPattern` batch flag — needs the upload wizard checkbox from session 23 `app/upload/page.tsx`
