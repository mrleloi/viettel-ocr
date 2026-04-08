# Action Guide: Session 21 — PDF Viewer + Verification UI + Batch Detail

> Created: 2026-04-08 (retroactive) | Created by: Antigravity (Claude Opus 4.6)
> Phase Step: 2.C.2 (Review Depth — Frontend)
> Target Agent: Developer
> Note: This guide was created **retroactively** after Session 21 ran without one (violation of Rule 18-19). It serves as the verification baseline for post-hoc review.

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 20 (Invoice DTO expansion + file/trace endpoints) → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `invoice-tool/packages/backend/`) → 0 errors
- [ ] Tests passing: `npm test` (from `invoice-tool/`) → ≥498 tests all green
- [ ] Frontend build: `npx next build` (from `invoice-tool/packages/frontend/`) → green
- [ ] Required files exist (Session 20 deliverables):
  - `invoice-tool/packages/backend/src/domain/processing/processing-trace.entity.ts`
  - `invoice-tool/packages/backend/src/interface/http/invoice.controller.ts` (has `GET :id/file` and `GET :id/traces` endpoints)
  - `invoice-tool/packages/backend/src/interface/http/dto/invoice-response.dto.ts` (expanded DTO with 20+ fields)
  - `invoice-tool/packages/frontend/src/lib/api-client.ts` (has `getInvoiceFileUrl()`, `getInvoiceTraces()`, `ProcessingTraceResponse`, `LineItemResponse`)

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
The review screen must be a real verification surface where operators can compare the original document (PDF) side-by-side with the extracted data, see per-field confidence scores to understand WHY a score is low (e.g., 6%), view validation errors with specific rule names, and trace the full processing pipeline. Currently, the review detail page only shows 7 editable text fields and 5 metadata lines — no PDF, no line items, no confidence breakdown, no validation panel, no pipeline trace. Operators cannot make informed approve/reject decisions.

Reference: `tasks/01-business-spec.md` § F08 (Review Queue & Approval) — ASCII mockup of two-column layout; `tasks/09-phase2-master-plan.md` § Issue 6

### Architecture Context
This is a **frontend-only** session within the REVIEW bounded context. All data is already available via the Session 20 API expansion:
- `GET /api/invoices/:id` → full `InvoiceResponse` with `lineItems`, `fieldConfidences`, `validationErrors`, `classificationMethod`, `pageCount`, etc.
- `GET /api/invoices/:id/file` → streams original PDF as `application/pdf`
- `GET /api/invoices/:id/traces` → returns ordered `ProcessingTraceResponse[]`

No backend changes needed. All work lives in `invoice-tool/packages/frontend/src/`.

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| N/A | Frontend-only session — no direct DB access |

### Data Flow
`Review Detail Page` → `apiClient.getInvoice(id)` → renders tabbed content + PDF iframe
`TraceTimeline` → `apiClient.getInvoiceTraces(id)` → renders pipeline stages with durations
`PDF Viewer` → `apiClient.getInvoiceFileUrl(id)` → iframe src URL for streaming PDF

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/frontend-component/skill.md` — React component patterns, CSS conventions, Next.js App Router
2. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/implement-page.md` — end-to-end Next.js page implementation
- `.agents/workflows/quality-gate-pipeline.md` — final verification

### Relevant Learned Rules
- `react-pdf` with Next.js Turbopack may need `next/dynamic` import to avoid SSR errors — consider `<iframe>` as simpler alternative (from `agent-notes.md` Phase 2 Risk Notes)
- No React Query — use `useState` + `useEffect` + `useCallback` for data fetching
- Vietnamese text via `VI` constant object from `src/lib/constants.ts` — never hardcode Vietnamese in JSX
- Amount formatting: `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`
- Confidence formatting: score 0-1 → ≥80% green, ≥60% amber, <60% red
- CSS organization: keep page-specific sections separated with comment headers
- `useParams()` for dynamic route `[id]`, `useRouter()` for navigation

---

## 3. Tasks (Ordered)

### Task 1: Rewrite Review Detail Page to Two-Column Layout

**Type**: GREEN (rewrite existing)
**File**: `invoice-tool/packages/frontend/src/app/review/[id]/page.tsx`

**What to do**:
1. Replace current single-column layout with two-column layout:
   - **Left panel**: PDF viewer (sticky, takes ~45% width)
   - **Right panel**: Tabbed content (takes ~55% width)
2. Add tab bar with 5 tabs: Extracted Data | Line Items | Confidence | Validation | Trace
3. Keep all existing functionality: approve/reject/edit/reprocess/create-schema actions
4. Add header bar with: invoice number, status badge, classification method badge, overall confidence ring, action buttons

**Layout structure**:
```
┌──────────────────────────────────────────────────┐
│ ← Back to queue                                  │
├──────────────────────────────────────────────────┤
│ InvoiceNumber  [Status]  [Method]  [Confidence]  │
│ [Approve] [Reject] [Reprocess] [Create Schema]   │
├──────────────────┬───────────────────────────────┤
│                  │ [Extracted] [Items] [Conf] ... │
│   PDF Viewer     │                               │
│   (iframe)       │   Tab content area            │
│   (sticky)       │                               │
│                  │                               │
└──────────────────┴───────────────────────────────┘
```

**Key decisions**:
| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF rendering | `<iframe>` with `src={fileUrl}` | Simpler than `react-pdf`, no SSR issues, browser-native PDF render |
| Tab state | `useState<TabKey>` | Simple local state, no routing needed |
| Sticky PDF | CSS `position: sticky; top: 0` | PDF stays visible while scrolling tabs |
| Responsive | Stack vertically on mobile | `@media (max-width: 768px)` → single column |

---

### Task 2: Create ConfidenceBreakdown Component

**Type**: GREEN (new component)
**File**: `invoice-tool/packages/frontend/src/components/review/ConfidenceBreakdown.tsx`

**What to do**:
1. Accept props: `overallScore: number | null`, `fieldConfidences: Record<string, number> | null`
2. Show overall score summary at top
3. Render per-field confidence bars sorted ascending (lowest first = needs most attention)
4. Color bars using project color bands: ≥90% green (success), 70-89% lighter green, 60-69% amber (warning), <60% red (error)
5. Add legend explaining color bands
6. Vietnamese field labels for common keys (invoice_number, seller_name, etc.)
7. Empty state when no data

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Sort ascending | Lowest confidence first | All same score |
| Color bands | ≥90% success, ≥70% good, ≥60% warning, <60% error | Exactly on boundary |
| Field labels | Map snake_case keys to Vietnamese labels | Unknown key → show raw key |
| Empty state | When fieldConfidences is null/empty | — |

---

### Task 3: Create LineItemsTable Component

**Type**: GREEN (new component)
**File**: `invoice-tool/packages/frontend/src/components/review/LineItemsTable.tsx`

**What to do**:
1. Accept props: `items: LineItemResponse[] | null`, `onCreateMapping?: (partnerProductName: string) => void`
2. Render table with columns: #, Name, Unit, Qty, Unit Price, Amount, VAT%, VAT Amount, Total
3. When `onCreateMapping` provided, add "Ánh xạ" (mapping) column with button per row
4. Format all amounts as VND currency
5. Show item count in footer
6. Empty state when no items

---

### Task 4: Create ValidationPanel Component

**Type**: GREEN (new component)
**File**: `invoice-tool/packages/frontend/src/components/review/ValidationPanel.tsx`

**What to do**:
1. Accept props: `validationErrors: { errors: string[]; warnings: string[] } | null`
2. Three states: no data (empty), all valid (success message), has issues (show errors + warnings)
3. Summary counts at top (❌ N errors, ⚠️ N warnings)
4. Errors section with red styling, warnings section with amber styling
5. Each item shows icon + message text

---

### Task 5: Create TraceTimeline Component

**Type**: GREEN (new component)
**File**: `invoice-tool/packages/frontend/src/components/review/TraceTimeline.tsx`

**What to do**:
1. Accept props: `invoiceId: string`
2. Self-fetching: call `apiClient.getInvoiceTraces(invoiceId)` on mount
3. Visual timeline with vertical connector line + dots
4. Each stage shows: icon, Vietnamese label, status (✓/✗/—), duration
5. Failed stages show error message
6. Total processing time at top
7. Vietnamese labels for all known stages: classify, extract, validate, score, route, map, maybe_create_schema
8. Loading skeleton state, empty state

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Stage labels | Map stage key to Vietnamese label | Unknown stage → show raw key |
| Status colors | completed=green, failed=red, skipped=muted | — |
| Duration format | <1000ms show as "Xms", ≥1000ms show as "X.Xs" | null → "—" |
| Total duration | Sum of all trace durationMs values | All null |
| Connector line | Between dots, except after last stage | Single stage |

---

### Task 6: Create Batch Detail Page

**Type**: GREEN (new page)
**File**: `invoice-tool/packages/frontend/src/app/batches/[id]/page.tsx`

**What to do**:
1. Fetch batch info from `apiClient.getBatch(id)` + invoices from `apiClient.listInvoices({ batchId: id })`
2. Show batch metadata card: ID, upload mode, total/processed/success/error files, dates, status badge
3. Show invoices table: invoice number, seller, buyer, total, confidence, status, created date
4. Each invoice row is clickable → navigates to `/review/{invoiceId}`
5. Back button → `/` (dashboard)
6. Loading skeleton, error state

---

### Task 7: Add CSS for All New Components (~600 lines)

**Type**: GREEN (append to globals.css)
**File**: `invoice-tool/packages/frontend/src/app/globals.css`

**What to do**:
Add CSS sections for:
1. `.review-detail-page` — page wrapper
2. `.review-header-bar` — header with invoice info + actions
3. `.review-two-col` — two-column grid layout
4. `.review-pdf-panel` + `.review-pdf-iframe` — PDF viewer panel with sticky positioning
5. `.review-tab-bar` + `.review-tab` — tab navigation
6. `.review-tab-content` — tab content area
7. `.confidence-breakdown` — overall score + per-field bars + legend
8. `.line-items-table` — line items table styling
9. `.validation-panel` — errors/warnings sections
10. `.trace-timeline` — vertical timeline with connectors
11. `.batch-detail-grid` — batch metadata grid
12. Responsive breakpoint at `768px`: stack two-col layout vertically

---

### Task 8: Update Constants (if needed)

**Type**: GREEN
**File**: `invoice-tool/packages/frontend/src/lib/constants.ts`

**What to do**:
Verify all Vietnamese strings needed by the new components exist in `VI.review`:
- `reprocess`, `reprocessSuccess`, `createSchemaFromInvoice`, `createSchemaSuccess` 
- `backToQueue`, `editMode`, `saveChanges`, `cancelEdit`
- `approveSuccess`, `rejectSuccess`, `editSuccess`

Add any missing keys.

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Frontend build — from invoice-tool/packages/frontend/
npx next build
# Expect: ✓ Compiled successfully, all routes listed

# Backend tests — from invoice-tool/ (to ensure no regressions)
npm test
# Expect: ≥498 tests passing

# Route verification — check build output includes:
#   ƒ /review/[id]       (dynamic)
#   ƒ /batches/[id]      (dynamic)

# Visual verification — start dev server and manually check:
#   1. Navigate to /review → click an invoice → two-column layout renders
#   2. PDF panel shows iframe (will be empty without backend running, but no error)
#   3. All 5 tabs switch correctly
#   4. /batches/[id] page renders with back button and invoice table
```

**Pass criteria**: Frontend build green, all backend tests pass, routes present, no console errors.

---

## 5. Acceptance Criteria

- [ ] `app/review/[id]/page.tsx` renders two-column layout (PDF left, tabs right)
- [ ] PDF viewer uses `<iframe>` with `apiClient.getInvoiceFileUrl(id)` as src
- [ ] PDF panel has "Open in new tab" link (`target="_blank"`) and shows filename
- [ ] Tab bar has 5 tabs: Extracted Data, Line Items, Confidence, Validation, Trace
- [ ] Tab switching works correctly (only active tab content visible)
- [ ] `ConfidenceBreakdown` component shows per-field bars with 90/70/60 color bands + legend
- [ ] `ConfidenceBreakdown` sorts fields ascending (lowest score first)
- [ ] `LineItemsTable` shows all columns: #, Name, Unit, Qty, Price, Amount, VAT%, VAT, Total
- [ ] `LineItemsTable` has optional "Ánh xạ" column with mapping button per row
- [ ] `ValidationPanel` shows errors (red) and warnings (amber) separately with counts
- [ ] `ValidationPanel` shows "valid" state when no errors/warnings
- [ ] `TraceTimeline` self-fetches traces and renders visual timeline with connectors
- [ ] `TraceTimeline` shows duration, status icon, error messages for failed stages
- [ ] `TraceTimeline` has Vietnamese labels for ALL pipeline stages including `maybe_create_schema`
- [ ] `app/batches/[id]/page.tsx` exists and shows batch metadata + invoice list
- [ ] Batch detail invoice rows are clickable → navigate to `/review/{id}`
- [ ] All existing review actions work: approve, reject, edit, reprocess, create schema
- [ ] CSS responsive: two-column stacks vertically on screens ≤768px
- [ ] `next build` passes with all routes
- [ ] `npm test` passes (≥498 tests, no regressions)
- [ ] All Vietnamese text uses `VI` constants (no hardcoded strings in JSX)
- [ ] No `PdfViewer.tsx` separate component needed — iframe approach is sufficient

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Two-column review page, 4 new review components, batch detail page, ~600 CSS lines
   - Found: {any surprises — e.g., iframe vs react-pdf decision}
   - What's Next: "Session 22: Field-def / fingerprint CRUD + schema preview" (Phase 2.D.1)

2. Update `.context/agent-notes.md`:
   - Test count (should be unchanged — frontend-only session)
   - Frontend component patterns learned
   - iframe PDF viewer pattern

3. Update `tasks/progress.md`:
   - Mark 2.C.2 as ✅ Done with session 21 and notes

4. Commit: `feat: two-column review page with PDF viewer, confidence breakdown, validation panel, trace timeline + batch detail page`

**Next session depends on**: Session 22 builds schema backend (field/rule CRUD, preview) — independent of Session 21 frontend work, but uses the same expanded InvoiceResponseDto from Session 20.
