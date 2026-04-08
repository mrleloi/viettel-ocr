# Action Guide: Session 16 — Navigation Fixes, Sidebar Badge, Product Sync Mock

> Created: 2026-04-08 | Created by: Antigravity
> Phase Step: 2.A.1 (Foundation & Notifications)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 15 (SSE + E2E) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `invoice-tool/packages/backend/`) → 0 errors
- [ ] Tests passing: `npm test` (from `invoice-tool/`) → all green (406 tests)
- [ ] Frontend build: `npm run build` (from `invoice-tool/packages/frontend/`) → green

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
Three user-reported issues from Phase 2 analysis:
- **Issue 1**: Dashboard "recent batches" rows have `clickable-row` class but no `onClick` handler, no batch detail route exists.
- **Issue 2**: Sidebar badge for "Kiểm duyệt" is hardcoded to `0`, never reads real data.
- **Issue 8**: Product sync returns 500 because `ViettelProductClient` uses empty string URL when `useMockProductApi === true`.

Reference: `tasks/09-phase2-master-plan.md` §1 (Issues 1, 2, 8)

### Architecture Context
All changes are in **frontend** (layout components, dashboard component, new batch detail page) and **one backend file** (ViettelProductClient mock URL fallback).

### Key Files
| File | Change |
|------|--------|
| `invoice-tool/packages/frontend/src/components/layout/Sidebar.tsx` | Live badge via polling |
| `invoice-tool/packages/frontend/src/components/layout/AppShell.tsx` | Pass badge data to Sidebar |
| `invoice-tool/packages/frontend/src/components/dashboard/RecentBatchesTable.tsx` | Add onClick → navigate to `/batches/[id]` |
| `invoice-tool/packages/frontend/src/app/batches/[id]/page.tsx` | **NEW** — batch detail placeholder |
| `invoice-tool/packages/backend/src/infrastructure/external-api/viettel-product.client.ts` | Fall back to `http://localhost:3002` when mock mode |
| `invoice-tool/packages/backend/src/infrastructure/config/env-config.service.ts` | Log which product endpoint at startup |

---

## 2. Mandatory Reading

### Skills
1. `.agents/skills/frontend-component/skill.md` — frontend patterns
2. `.agents/skills/quality-self-check/skill.md` — always

### Workflows
- `.agents/workflows/session-handoff.md`

### Relevant Learned Rules
- Frontend data fetching: `useState` + `useEffect` + `useCallback` pattern
- Vietnamese text: all strings via `VI` constant from `@/lib/constants`
- API client: typed `apiClient` at `src/lib/api-client.ts`
- `next build` for production check
- No React Query — use `useState` + `useEffect` polling

---

## 3. Tasks (Ordered)

### Task 1: Fix ViettelProductClient mock fallback (Backend)

**Type**: GREEN (implement — bug fix)
**File**: `invoice-tool/packages/backend/src/infrastructure/external-api/viettel-product.client.ts`

**What to do**:
- In `fetchProducts()` and `healthCheck()`, resolve the base URL:
  - If `this.config.useMockProductApi` is `true`, use `http://localhost:3002` instead of empty string
- Add a private getter `get baseUrl(): string` that returns the resolved URL
- Add a startup log in the constructor: `console.log(...)` indicating which endpoint is used

**Verify**: `npm test` from `invoice-tool/` — existing ViettelProductClient tests should still pass.

---

### Task 2: Log product endpoint at config startup (Backend)

**Type**: GREEN (implement)
**File**: `invoice-tool/packages/backend/src/infrastructure/config/env-config.service.ts`

**What to do**:
- Add a `logProductEndpoint()` method that logs whether mock or real API is used
- This gets called from ViettelProductClient constructor (Task 1)

---

### Task 3: Fix sidebar badge — live needs_review count (Frontend)

**Type**: GREEN (implement)
**Files**: 
- `invoice-tool/packages/frontend/src/components/layout/Sidebar.tsx`
- `invoice-tool/packages/frontend/src/components/layout/AppShell.tsx`

**What to do**:
- In `AppShell.tsx`: add a `useEffect` that polls `apiClient.listInvoices({ status: 'needs_review' })` every 30 seconds
- Pass the count as a prop to `Sidebar`
- In `Sidebar.tsx`: accept `reviewCount: number` prop, display it in the badge instead of hardcoded `0`
- Badge should hide when count is `0`

---

### Task 4: Fix dashboard row click → navigate to batch detail (Frontend)

**Type**: GREEN (implement)
**File**: `invoice-tool/packages/frontend/src/components/dashboard/RecentBatchesTable.tsx`

**What to do**:
- Import `useRouter` from `next/navigation`
- Add `onClick={() => router.push(`/batches/${batch.id}`)}` on each `<tr>`
- Add `cursor: pointer` style (already has `clickable-row` CSS class)

---

### Task 5: Create batch detail placeholder page (Frontend)

**Type**: GREEN (implement — new file)
**File**: `invoice-tool/packages/frontend/src/app/batches/[id]/page.tsx` **[NEW]**

**What to do**:
- Create a basic batch detail page that:
  - Fetches batch by ID: `apiClient.getBatch(id)`
  - Fetches invoices for that batch: `apiClient.listInvoices({ batchId: id })`
  - Shows batch metadata (status, total files, success/error counts, created date)
  - Lists invoices in a table with clickable rows → `/review/{invoiceId}`
- Add route mapping in `AppShell.tsx` `getPageTitle()` for `/batches` → `'Chi tiết lô hóa đơn'`
- Style using existing CSS classes (card, table-container, status-badge etc.)

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell

```powershell
# Backend tests — from invoice-tool/packages/backend/
npx tsc --noEmit
npx jest --bail

# Frontend build — from invoice-tool/packages/frontend/
npm run build

# Backend smoke test — from project root
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"
```

**Pass criteria**: ALL commands succeed.

---

## 5. Acceptance Criteria

- [ ] Sidebar badge shows real `needs_review` invoice count (not hardcoded `0`)
- [ ] Sidebar badge hides when count is 0
- [ ] Dashboard "recent batches" rows are clickable → navigates to `/batches/[id]`
- [ ] `/batches/[id]` page shows batch info + invoice list
- [ ] `POST /api/products/sync` returns 200 with mock data (no more 500)
- [ ] Products page lists mock products after sync
- [ ] Backend tests pass (≥406)
- [ ] Frontend `next build` passes
- [ ] Smoke test passes

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: nav fixes, sidebar badge, product sync mock
   - Found: any surprises
   - What's Next: "Session 17: Notification domain + backend"

2. Update `.context/agent-notes.md` + `tasks/progress.md`

3. Commit: `fix: dashboard nav, sidebar badge, product sync mock (session 16)`

**Next session depends on**: Working sidebar badge polling pattern (Session 18 will convert to SSE)
