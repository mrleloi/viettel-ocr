# Action Guide: Session 25 — Products Conflicts + Mappings from Review

> Created: 2026-04-08 | Created by: Architect (Session 24)
> Phase Step: 2.E.1 (Catalog & Output Polish)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 24 (Auto-create Schema) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → 527 tests green
- [ ] Frontend build: `npm run build` (from `packages/frontend/`) → clean
- [ ] Required files exist:
  - `packages/backend/src/infrastructure/database/repositories/sync-conflict.repository.impl.ts` — SyncConflict repo (has `findUnresolved()` + `resolve()`)
  - `packages/backend/src/interface/http/product.controller.ts` — ProductController (no conflict endpoint yet)
  - `packages/frontend/src/components/mapping/CreateMappingDialog.tsx` — dialog for creating mappings
  - `packages/frontend/src/components/review/LineItemsTable.tsx` — line items display (no actions yet)
  - `packages/frontend/src/app/review/[id]/page.tsx` — review detail page

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
- **F06 conflict resolution**: When products are synced twice with edited data, conflicts appear. Operator needs to resolve them (keep local vs accept remote). Session 25 adds the UI page and the backend endpoint.
- **F07 mapping from review**: From the review detail page, an operator seeing an unmapped line item should be able to create a mapping directly in 2 clicks, without leaving the review screen.

Reference: `tasks/01-business-spec.md` § F06, F07
Reference: `tasks/09-phase2-master-plan.md` § Session 25

### Architecture Context
- **SyncConflict entity** (`domain/product/sync-conflict.entity.ts`) — already exists
- **ISyncConflictRepository** (`domain/product/sync-conflict.repository.ts`) — interface exists
- **SyncConflictRepositoryImpl** — implementation exists with `findUnresolved()` and `resolve('keep_local' | 'accept_remote')`
- **ProductController** — needs `ISyncConflictRepository` injection + new resolve endpoint
- **CreateMappingDialog** — exists, supports `preSelectedSchemaId` but NOT `preFilledPartnerProductName`
- **LineItemsTable** — pure display, no actions; needs extension

### Data Flow
```
Backend:
  GET /api/products/conflicts          → ProductController → SyncConflictRepo.findUnresolved()
  POST /api/products/conflicts/:id/resolve → ProductController → SyncConflictRepo.resolve()

Frontend:
  app/products/conflicts/page.tsx      → lists conflicts → resolve buttons
  review/[id] page.tsx (Line Items tab) → "Tạo mapping" per row → CreateMappingDialog
```

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills
1. `.agents/skills/quality-self-check/skill.md` — always

### Learned Rules to remember
- DI tokens: `'ISyncConflictRepository'` (check interface file for exact token)
- `ProductController` is in `InterfaceModule` → make sure module imports the token
- No smoke test MANDATORY for this session (no new DI tokens added — just adding endpoint to existing controller and adding repo injection)
  - Actually: ProductController gains `@Inject('ISyncConflictRepository')` → this IS a DI change → smoke test MANDATORY
- `CreateMappingDialog` needs a new optional prop `preFilledPartnerProductName?: string`
- OS: Windows PowerShell — no bash `&&`, use separate commands or `;`

---

## 3. Tasks (Ordered)

### Task 1: Extend `CreateMappingDialog` — pre-fill partner name

**Type**: GREEN
**File**: `packages/frontend/src/components/mapping/CreateMappingDialog.tsx`

**What to do**:
1. Add optional prop `preFilledPartnerProductName?: string` to `CreateMappingDialogProps`
2. In `useState`, initialize `partnerProductName` from prop: `useState(preFilledPartnerProductName ?? '')`
3. Add `useEffect` to reset `partnerProductName` when prop changes (for re-use with different items)

---

### Task 2: Backend — conflict resolution endpoint

**Type**: RED then GREEN
**Files**:
- `packages/backend/src/interface/http/product.controller.ts` — add endpoint
- `packages/backend/src/interface/http/dto/product-response.dto.ts` — add `ConflictResponseDto`, `ResolveConflictDto`
- `packages/backend/src/interface/http/__tests__/product.controller.spec.ts` (if exists) or create it

**What to do**:
1. Add `ResolveConflictDto` class with `@IsEnum(['keep_local', 'accept_remote', 'ignore'])` field `action`
2. Add `ConflictResponseDto` with fields: `id`, `productId`, `fieldName`, `localValue`, `remoteValue`, `createdAt`
3. Add `GET /api/products/conflicts` → `SyncConflictRepo.findUnresolved()` → map to `ConflictResponseDto[]`
4. Add `POST /api/products/conflicts/:id/resolve` → resolve with `action`:
   - `'keep_local'` → `SyncConflictRepo.resolve(id, 'keep_local')`
   - `'accept_remote'` → `SyncConflictRepo.resolve(id, 'accept_remote')`
   - `'ignore'` → `SyncConflictRepo.resolve(id, 'keep_local')` (treat ignore as keep local, mark resolved)
5. Inject `@Inject('ISyncConflictRepository')` into `ProductController` constructor

**Check**: Does `ISyncConflictRepository` token exist in `interface.module.ts` providers? Probably not — check ApplicationModule and add if missing.

---

### Task 3: Register `ISyncConflictRepository` in module (if not already there)

**Type**: GREEN
**File**: `packages/backend/src/application/application.module.ts`

**What to do**:
Check if `SyncConflictRepositoryImpl` is already registered. If not, add it under `'ISyncConflictRepository'` token.

Also check `InterfaceModule` — if `ProductController` uses `ISyncConflictRepository`, the `InterfaceModule` must import the module that provides it.

---

### Task 4: Frontend — `apiClient` conflict methods

**Type**: GREEN
**File**: `packages/frontend/src/lib/api-client.ts`

**What to do**:
Add types and methods:
```typescript
export interface ConflictResponse {
  id: string;
  productId: string;
  fieldName: string;
  localValue: string;
  remoteValue: string;
  createdAt: string;
}

// in apiClient object:
listConflicts: () => apiFetch<ConflictResponse[]>('/products/conflicts'),
resolveConflict: (id: string, action: 'keep_local' | 'accept_remote' | 'ignore') =>
  apiFetch<void>(`/products/conflicts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  }),
```

---

### Task 5: Frontend — `app/products/conflicts/page.tsx`

**Type**: GREEN

**What to do**:
Create `app/products/conflicts/page.tsx` as a client component:
- On mount: fetch conflicts via `apiClient.listConflicts()`
- Display as a table: `fieldName`, `localValue`, `remoteValue`, `createdAt`
- Per row: three action buttons — "Giữ local", "Chấp nhận remote", "Bỏ qua"
- On action: call `apiClient.resolveConflict(id, action)` → remove row from list → show toast
- Link this page from `app/products/page.tsx` (add a "Xem xung đột" link/button if there are conflicts)
- Also add navigation link from Sidebar or breadcrumbs (optional)

**Constants** to add to `VI.product`:
- `conflicts: 'Xung đột dữ liệu'`
- `viewConflicts: 'Xem xung đột'`
- `keepLocal: 'Giữ local'`
- `acceptRemote: 'Chấp nhận remote'`
- `ignoreConflict: 'Bỏ qua'`
- `resolveSuccess: 'Đã giải quyết xung đột'`
- `noConflicts: 'Không có xung đột nào'`

---

### Task 6: Frontend — "Tạo mapping" in review detail Line Items tab

**Type**: GREEN
**Files**:
- `packages/frontend/src/app/review/[id]/page.tsx` — import + use `CreateMappingDialog`
- `packages/frontend/src/components/review/LineItemsTable.tsx` — add optional `onCreateMapping` callback

**What to do**:

1. **Extend `LineItemsTable` props**:
```typescript
interface LineItemsTableProps {
  items: LineItemResponse[] | null | undefined;
  onCreateMapping?: (partnerProductName: string) => void; // NEW
}
```

2. **Add "+" button** in each row's last cell when `onCreateMapping` is provided:
```tsx
{onCreateMapping && (
  <td style={{ width: 60 }}>
    <button type="button" className="btn btn-xs btn-ghost" onClick={() => onCreateMapping(item.name)}>
      + Ánh xạ
    </button>
  </td>
)}
```
Also add a column header `<th style={{ width: 60 }}>Ánh xạ</th>` when `onCreateMapping` is set.

3. **In review detail page** (`review/[id]/page.tsx`):
   - Import `CreateMappingDialog`
   - Add state: `mappingDialogOpen: boolean`, `mappingDialogPartnerName: string`
   - Pass `onCreateMapping` to `<LineItemsTable>`:
     ```tsx
     <LineItemsTable
       items={invoice.lineItems}
       onCreateMapping={(name) => {
         setMappingDialogPartnerName(name);
         setMappingDialogOpen(true);
       }}
     />
     ```
   - Render `<CreateMappingDialog open={...} onClose={...} onCreated={...} preSelectedSchemaId={invoice.schemaId ?? undefined} preFilledPartnerProductName={mappingDialogPartnerName} />`

---

### Task 7: Frontend — link conflicts page from products page

**Type**: GREEN
**File**: `packages/frontend/src/app/products/page.tsx`

**What to do**:
Add a "Xem xung đột" button/link near the sync button that navigates to `/products/conflicts`.
This is optional but makes the feature discoverable.

---

## 4. Quality Gate

> ⚠️ OS: Windows + PowerShell. Do NOT use bash `&&`.

```powershell
# From packages/backend/
npx tsc --noEmit
npx jest --bail

# From packages/frontend/
npm run build

# From project root (DI-touching session — ProductController gets new inject)
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# Architecture check (use Grep tool):
#   "@nestjs" in packages/backend/src/domain/ → expect 0 results
```

---

## 5. Acceptance Criteria

- [ ] `GET /api/products/conflicts` → returns list of unresolved conflicts
- [ ] `POST /api/products/conflicts/:id/resolve` → resolves with keep_local / accept_remote / ignore
- [ ] `app/products/conflicts/page.tsx` renders conflict list with resolve buttons
- [ ] Resolving a conflict removes it from the list (or re-fetches)
- [ ] Each line item in review detail has a "+ Ánh xạ" button (when `onCreateMapping` is provided)
- [ ] Clicking "+" opens `CreateMappingDialog` pre-filled with the item name
- [ ] `CreateMappingDialog` accepts `preFilledPartnerProductName` prop
- [ ] All tests pass (`jest --bail`)
- [ ] `tsc --noEmit` passes (backend + frontend)
- [ ] `npm run build` passes (frontend)
- [ ] Smoke test passes
- [ ] Session handoff updated
- [ ] Agent notes updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: conflict resolution page + resolve endpoint + mapping-from-review
   - Found: any surprises
   - What's Next: "Session 26: Filtered exports + batch export from review" (Phase 2.E)

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Any new learned rules

3. Commit: `feat: product conflict resolution + create mapping from review`

**Next session depends on**: Sessions 1-25 complete, review detail functional, mapping CRUD working
