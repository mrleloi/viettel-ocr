# Action Guide: Session 26 — Filtered Exports + Batch Export from Review

> Created: 2026-04-08 | Created by: Architect (Session 25)
> Phase Step: 2.E.2 (Catalog & Output Polish — final session)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 25 (Products Conflicts + Mappings from Review) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → 533 tests green
- [ ] Frontend build: `npm run build` (from `packages/frontend/`) → clean, 13 routes
- [ ] Required files exist:
  - `packages/backend/src/application/export/create-export.use-case.ts` — use case with `fetchFilteredInvoices()`
  - `packages/backend/src/interface/http/dto/create-export.dto.ts` — `CreateExportDto` (has format, batchId, schemaId, dateFrom, dateTo — missing `status`)
  - `packages/backend/src/domain/invoice/invoice.repository.ts` — `IInvoiceRepository` (has `findByBatchId`, `findRecent` — missing `findByFilters`)
  - `packages/frontend/src/components/export/ExportForm.tsx` — form with all filter fields (no status filter yet)
  - `packages/frontend/src/app/batches/[id]/page.tsx` — batch detail page (no export button yet)

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
- **F10 — filtered export**: The export page already has date/schema/batch filters in the UI. These ARE sent to the backend correctly. However, the use case returns empty when no `batchId` is provided (it only queries `findByBatchId` currently). We need to wire up "query all invoices with filters applied".
- **F10 — batch export from review**: On `app/batches/[id]/page.tsx`, add an "Export this batch" action that pre-fills `batchId` and navigates to the export page OR triggers export inline.
- **F10 — status filter**: Add `status` as an additional filter field (e.g., export only `approved` invoices). This is the most common real-world use case.

Reference: `tasks/01-business-spec.md` § F10
Reference: `tasks/09-phase2-master-plan.md` § Session 26

### Architecture Context

**Current export flow** (working but limited):
1. `POST /api/exports` with `{ format, batchId?, schemaId?, dateFrom?, dateTo? }`
2. `CreateExportUseCase.fetchFilteredInvoices()`:
   - If `batchId` → `invoiceRepo.findByBatchId(batchId)` → filters approved only → applies schemaId + date filters
   - If no `batchId` → returns `[]` (broken — the comment says "In a real implementation this would use a query builder")
3. **Fix needed**: Add `IInvoiceRepository.findByFilters(filters)` for the no-batchId path

**Missing pieces**:
- `IInvoiceRepository` has no `findByFilters()` method
- `CreateExportDto` has no `status` field
- `CreateExportInput` has no `status` field
- `ExportForm` has no status dropdown
- `app/batches/[id]/page.tsx` has no "Export this batch" button

### Data Flow (after session)
```
ExportForm (with status filter) → POST /api/exports → ExportController → CreateExportUseCase
  → invoiceRepo.findByBatchId() (if batchId)
  → invoiceRepo.findByFilters({ status?, schemaId?, dateFrom?, dateTo? }) (if no batchId)
  → apply remaining filters → serialize → save → return metadata

BatchDetailPage → "Export this batch" button → navigate to /exports?batchId=xxx (URL param)
  OR inline: apiClient.createExport({ format: 'csv', batchId }) → show result
```

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills
1. `.agents/skills/quality-self-check/skill.md` — always

### Learned Rules to remember
- `IInvoiceRepository` interface is in `domain/invoice/invoice.repository.ts` — add method there, then implement in `infrastructure/database/repositories/invoice.repository.impl.ts`
- Test helper `createTestDb()` DDL must stay in sync with connection.ts — but this session adds NO new columns, only new query methods
- `findRecent(status, limit)` already exists — `findByFilters` is a new method with no limit
- **No DI changes** in this session — no new `@Inject()` tokens → smoke test NOT mandatory (but run if unsure)
- OS: Windows PowerShell — no bash `&&`

---

## 3. Tasks (Ordered)

### Task 1: Add `findByFilters()` to `IInvoiceRepository` + implementation

**Type**: RED then GREEN
**Files**:
- `packages/backend/src/domain/invoice/invoice.repository.ts` — add method to interface
- `packages/backend/src/infrastructure/database/repositories/invoice.repository.impl.ts` — implement

**What to do**:

1. Add to `IInvoiceRepository` interface:
```typescript
/**
 * Find invoices matching a set of optional filters.
 * @param filters Optional status, schemaId, dateFrom, dateTo filters
 * @returns Matching invoices (all if no filters)
 */
findByFilters(filters: {
  status?: string;
  schemaId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Invoice[]>;
```

2. Implement in `InvoiceRepositoryImpl`:
```typescript
async findByFilters(filters: {
  status?: string;
  schemaId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Invoice[]> {
  let query = this.db.select().from(invoices);
  const conditions = [];
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  if (filters.schemaId) conditions.push(eq(invoices.schemaId, filters.schemaId));
  if (filters.dateFrom) conditions.push(gte(invoices.createdAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(invoices.createdAt, filters.dateTo));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  const rows = await query.all();
  return rows.map((row) => Invoice.reconstitute(this.toDomain(row)));
}
```

**Note**: Check the drizzle import for `and`, `gte`, `lte` — they come from `drizzle-orm`.

**Tests to write first** (RED): In `invoice.repository.impl.spec.ts`, add:
- `findByFilters({ status: 'approved' })` returns only approved invoices
- `findByFilters({})` returns all invoices
- `findByFilters({ status: 'approved', schemaId: 'schema-1' })` returns filtered subset

---

### Task 2: Add `status` filter to `CreateExportDto` + `CreateExportInput`

**Type**: GREEN
**Files**:
- `packages/backend/src/interface/http/dto/create-export.dto.ts`
- `packages/backend/src/application/export/create-export.use-case.ts`

**What to do**:

1. Add to `CreateExportDto`:
```typescript
@ApiPropertyOptional({ description: 'Filter by invoice status (e.g., approved)' })
@IsOptional()
@IsString()
statusFilter?: string;
```

2. Add to `CreateExportInput`:
```typescript
/** Optional status filter (e.g. 'approved') */
readonly statusFilter?: string;
```

3. In `ExportController.createExport()`, pass `statusFilter: dto.statusFilter` through to the use case.

---

### Task 3: Fix `CreateExportUseCase.fetchFilteredInvoices()` — no-batchId path

**Type**: GREEN
**File**: `packages/backend/src/application/export/create-export.use-case.ts`

**Current broken code** (line 106-109):
```typescript
} else {
  // For now, without a general query method, we return empty
  return [];
}
```

**Replace with**:
```typescript
} else {
  // Use findByFilters for non-batch exports
  const invoices = await this.invoiceRepo.findByFilters({
    status: input.statusFilter,
    schemaId: input.schemaId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });
  for (const inv of invoices) {
    allInvoices.push(this.toExportable(inv));
  }
}
```

Also update the `filter` step below to skip `schemaId`/`dateFrom`/`dateTo` for the no-batchId case (they're already applied in `findByFilters`). Actually it's fine to double-filter — the filter step is idempotent. But do add the `statusFilter` check for the `batchId` path:
```typescript
// In the filter step, also apply status filter for batchId path
if (input.statusFilter && inv.status !== input.statusFilter) {
  return false;
}
```

**Tests to update/add** in `create-export.use-case.spec.ts`:
- When `batchId` not provided and `statusFilter = 'approved'`, calls `findByFilters({ status: 'approved' })`
- When `batchId` not provided and no `statusFilter`, calls `findByFilters({})` and returns all results

---

### Task 4: Frontend — Add `statusFilter` to `ExportForm` + `ExportFormData`

**Type**: GREEN
**File**: `packages/frontend/src/components/export/ExportForm.tsx`

**What to do**:

1. Add `statusFilter?: string` to `ExportFormData` interface
2. Add status dropdown state: `const [statusFilter, setStatusFilter] = useState('approved')`
3. Add to form data in `handleSubmit`: `...(statusFilter && { statusFilter })`
4. Add UI dropdown in the filters section:
```tsx
<div className="export-filter-field">
  <label htmlFor="export-status-filter" className="export-form-label">
    Trạng thái
  </label>
  <select
    id="export-status-filter"
    className="form-select"
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
  >
    <option value="">Tất cả</option>
    <option value="approved">Đã duyệt</option>
    <option value="needs_review">Cần kiểm duyệt</option>
    <option value="rejected">Từ chối</option>
  </select>
</div>
```

5. Update `apiClient.createExport()` type signature to include `statusFilter?: string` (in `api-client.ts`)

---

### Task 5: Frontend — "Export this batch" on batch detail page

**Type**: GREEN
**File**: `packages/frontend/src/app/batches/[id]/page.tsx`

**What to do**:

1. Add export state: `const [exporting, setExporting] = useState(false)`
2. Add `handleExport()` function:
```typescript
const handleExport = async () => {
  try {
    setExporting(true);
    const result = await apiClient.createExport({ format: 'csv', batchId: batchId });
    // Navigate to download or show result
    setToast({ message: `Xuất thành công: ${result.recordCount} hóa đơn`, type: 'success' });
    // Open download in new tab
    window.open(`/api/exports/${result.exportId}/download`, '_blank');
  } catch (err) {
    setToast({ message: err instanceof Error ? err.message : VI.common.error, type: 'error' });
  } finally {
    setExporting(false);
  }
};
```
3. Add button in the batch detail header actions area (near existing buttons):
```tsx
<button
  type="button"
  className="btn btn-secondary btn-sm"
  onClick={handleExport}
  disabled={exporting}
  id="export-batch-btn"
>
  📁 {exporting ? 'Đang xuất...' : 'Xuất CSV'}
</button>
```

**Note**: Check if `batches/[id]/page.tsx` has a `toast` state already. If not, add one following the same pattern as other pages (useState + setTimeout dismiss).

---

## 4. Quality Gate

> ⚠️ OS: Windows + PowerShell. Do NOT use bash `&&`.

```powershell
# From packages/backend/
npx tsc --noEmit
npx jest --bail

# From packages/frontend/
npm run build

# Architecture check (use Grep tool):
#   "@nestjs" in packages/backend/src/domain/ → expect 0 results

# Smoke test: NOT mandatory for this session (no new DI tokens)
# But run it if you modified any *.module.ts or @Inject() decorators
```

---

## 5. Acceptance Criteria

- [ ] `POST /api/exports` with no `batchId` returns non-empty results when invoices exist
- [ ] `POST /api/exports` with `statusFilter=approved` returns only approved invoices
- [ ] `POST /api/exports` with `batchId` + `statusFilter` applies both filters
- [ ] `ExportForm` has a status dropdown defaulting to 'approved'
- [ ] `app/batches/[id]/page.tsx` has "Xuất CSV" button that triggers export + opens download
- [ ] All backend tests pass (`jest --bail`)
- [ ] `tsc --noEmit` passes (backend + frontend)
- [ ] `npm run build` passes (frontend)
- [ ] Session handoff updated
- [ ] Agent notes updated (Phase 2 DOD check: ≥ 480 tests, all F01–F11 ✅ or deferred)

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: filtered exports + batch export button
   - Phase 2 complete if all tests pass + F01–F11 coverage matrix is ✅/deferred
   - What's Next: Phase 2 complete — run `tasks/09-phase2-master-plan.md` Phase exit criteria

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Note Phase 2 completion status

3. Commit: `feat: filtered export with status filter + batch export from detail page`

4. **Phase 2 DOD check** (from `tasks/09-phase2-master-plan.md`):
   - `npm test ≥ 480` — check total
   - `next build` green ✅
   - `smoke-test.ps1` green ✅
   - F01–F11 all ✅ or explicitly deferred (F12, F13 are deferred)

**Next session**: Phase 2 complete! If DOD passes, begin Phase 3 planning or bug-fixing sprint.
