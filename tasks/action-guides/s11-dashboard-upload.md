# Session 11: Dashboard + Upload Pages

> Phase 4.2 + 4.3 — Interactive Dashboard + File Upload

---

## §0 Pre-Flight Checklist

- [ ] Read `.context/session-handoff.md` — confirm Session 10 complete
- [ ] Read `.context/agent-notes.md` — note frontend patterns
- [ ] Run `cd invoice-tool\packages\backend; npx jest --bail --no-coverage` — verify green
- [ ] Run `cd invoice-tool\packages\frontend; npx next build` — verify build passes
- [ ] Start backend: `cd invoice-tool\packages\backend; npx nest start`

---

## §1 Context & References

### Spec References
- `documents/01-business-spec.md` — F01 Upload, F12 Dashboard
- `documents/05-data-flow-design.md` — Upload flow, Dashboard data sources
- `documents/06-low-level-design.md` — Component list

### Architecture Position
```
packages/frontend/
  ├── src/app/page.tsx           ← Dashboard (REPLACE stub)
  ├── src/app/upload/page.tsx    ← Upload (REPLACE stub)
  ├── src/components/dashboard/  ← NEW dashboard components
  ├── src/components/upload/     ← NEW upload components
  ├── src/lib/api-client.ts      ← Already done (Session 10)
  └── src/lib/constants.ts       ← Already done (Session 10)
```

### Existing API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| GET /api/batches | Dashboard recent batches |
| GET /api/invoices?status=needs_review | Dashboard pending count |
| POST /api/batches | Upload batch |
| GET /api/schemas | Schema list for upload hint |

### OS/Shell
- Windows 11, PowerShell
- Avoid `&&`, `grep -r`, bash-isms

---

## §2 Mandatory Reading

### Skills
1. **Frontend Component** (`skills/frontend-component/skill.md`) — Next.js page/component patterns
2. **Quality Self-Check** (`skills/quality-self-check/skill.md`) — post-implementation checklist

### Workflows
1. **Implement Page** (`workflows/implement-page.md`) — frontend page implementation
2. **Quality Gate Pipeline** (`workflows/quality-gate-pipeline.md`) — pre-commit checks

---

## §3 Tasks

### 3.1 Dashboard Page (Replace Stub)
- Fetch real data from API:
  - `apiClient.listBatches()` for recent batches
  - `apiClient.listInvoices({ status: 'needs_review' })` for pending review count
- **Components**:
  - `StatCard` — reusable stat card (label, value, trend)
  - `RecentBatchesTable` — table with status badges, clickable rows
  - `ActivityFeed` — recent processing activity
- Handle loading, error, and empty states
- All text via `VI` constants

### 3.2 Upload Page (Replace Stub)
- **FileDropzone** client component:
  - Drag & drop zone for PDF/ZIP files
  - File list with size, name, remove button
  - Upload mode selector (single_ncc | mixed)
  - Schema hint dropdown (from `apiClient.listSchemas()`)
  - Upload button → calls `apiClient.uploadBatch()`
  - Progress indicator during upload
- **UploadResult** component:
  - Shows batch ID, status, file count after upload
  - Link to review queue
- Handle file validation (PDF/ZIP only, max size)
- Error handling with user-friendly messages

### 3.3 React Query Setup (Optional)
- Install `@tanstack/react-query`
- Create QueryClientProvider wrapper
- Custom hooks: `useBatches()`, `useInvoices()`, `useSchemas()`
- Cache invalidation after mutations

### 3.4 SSE Integration (Optional — defer if time-constrained)
- `useSSE()` hook for real-time batch progress
- Update dashboard stats in real-time
- Show toast notifications for completed batches

---

## §4 Quality Gate

```powershell
# 1. Backend still green
cd invoice-tool\packages\backend; npx tsc --noEmit
cd invoice-tool\packages\backend; npx jest --bail --no-coverage

# 2. Frontend builds
cd invoice-tool\packages\frontend; npx next build

# 3. Manual check: open http://localhost:3001 and verify:
#    - Dashboard loads data (or shows loading state)
#    - Upload page renders drag & drop zone
#    - Upload flow works end-to-end (with backend running)
```

---

## §5 Acceptance Criteria

1. [ ] Dashboard shows real data from API (or graceful loading/error states)
2. [ ] Upload page has functional drag & drop zone
3. [ ] Upload flow creates a batch via API
4. [ ] File validation rejects non-PDF/ZIP files
5. [ ] `npx next build` passes
6. [ ] All Vietnamese text from constants (no hardcoded strings)

---

## §6 Handoff

- Update `.context/session-handoff.md`
- Update `.context/agent-notes.md` (frontend patterns, React Query setup)
- Create Session 12 action guide: `tasks/action-guides/s12-review-pages.md`
