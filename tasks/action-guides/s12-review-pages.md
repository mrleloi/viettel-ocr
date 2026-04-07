# Session 12: Review Queue + Invoice Detail Pages

> Phase 4.4 — Review Queue + Invoice Detail

---

## §0 Pre-Flight Checklist

- [ ] Read `.context/session-handoff.md` — confirm Session 11 complete
- [ ] Read `.context/agent-notes.md` — note frontend patterns
- [ ] Run `cd invoice-tool\packages\backend; npx jest --bail --no-coverage` — verify green
- [ ] Run `cd invoice-tool\packages\frontend; npx next build` — verify build passes
- [ ] Start backend: `cd invoice-tool\packages\backend; npx nest start`

---

## §1 Context & References

### Spec References
- `documents/01-business-spec.md` — F03 Review, F04 Approve/Reject
- `documents/05-data-flow-design.md` — Review flow, Invoice detail
- `documents/06-low-level-design.md` — Component list

### Architecture Position
```
packages/frontend/
  ├── src/app/review/page.tsx        ← Review queue (REPLACE stub)
  ├── src/app/review/[id]/page.tsx   ← Invoice detail (NEW)
  ├── src/components/review/         ← NEW review components
  ├── src/lib/api-client.ts          ← Already done (Session 10)
  └── src/lib/constants.ts           ← Already done (Session 10)
```

### Existing API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| GET /api/invoices | List invoices with status filter |
| GET /api/invoices/:id | Invoice detail |
| POST /api/invoices/:id/approve | Approve invoice |
| POST /api/invoices/:id/reject | Reject invoice |
| PUT /api/invoices/:id | Edit invoice fields |

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

### 3.1 Review Queue Page (Replace Stub)
- Fetch invoices with `apiClient.listInvoices({ status: 'needs_review' })`
- **Components**:
  - `ReviewFilter` — filter by status, date range, confidence score
  - `InvoiceTable` — table with columns: invoice number, seller, amount, confidence, status, date
  - Status badges with color coding
  - Clickable rows → navigate to `/review/[id]`
- Handle loading, error, and empty states
- Pagination or infinite scroll

### 3.2 Invoice Detail Page (New)
- Route: `/review/[id]/page.tsx`
- Fetch invoice with `apiClient.getInvoice(id)`
- **Components**:
  - `InvoiceHeader` — invoice number, status badge, confidence score
  - `ExtractedDataCard` — all extracted fields in organized layout
  - `ActionBar` — approve/reject/edit buttons
  - `RejectDialog` — modal for reject reason
  - `EditableField` — inline-editable invoice field
- Two-column layout: extracted data (left) + metadata/actions (right)
- Handle approve/reject/edit workflows

### 3.3 Action Workflows
- **Approve**: `apiClient.approveInvoice(id, reviewedBy)` → redirect to queue
- **Reject**: show dialog for reason → `apiClient.rejectInvoice(id, reviewedBy, reason)` → redirect
- **Edit**: toggle editable mode → `apiClient.editInvoice(id, changes)` → refresh

---

## §4 Quality Gate

```powershell
# 1. Backend still green
cd invoice-tool\packages\backend; npx tsc --noEmit
cd invoice-tool\packages\backend; npx jest --bail --no-coverage

# 2. Frontend builds
cd invoice-tool\packages\frontend; npx next build

# 3. Manual check: open http://localhost:3001/review and verify:
#    - Review queue loads data (or shows loading state)
#    - Invoice detail page shows extracted data
#    - Approve/reject flow works with backend running
```

---

## §5 Acceptance Criteria

1. [ ] Review queue shows invoice list with status filter
2. [ ] Invoice detail page shows all extracted fields
3. [ ] Approve flow works end-to-end
4. [ ] Reject flow with reason dialog works
5. [ ] `npx next build` passes
6. [ ] All Vietnamese text from constants (no hardcoded strings)

---

## §6 Handoff

- Update `.context/session-handoff.md`
- Update `.context/agent-notes.md` (review patterns)
- Create Session 13 action guide: `tasks/action-guides/s13-schema-mapping-pages.md`
