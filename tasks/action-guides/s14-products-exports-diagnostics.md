# Action Guide: Session 14 — Products, Exports & Diagnostics Pages

> Created: 2026-04-07 | Created by: Antigravity
> Phase Step: 4.7 + 4.8 + 4.9
> Target Agent: Developer

---

## §0 Pre-Flight Checklist

- [ ] Session 13 complete → `.context/session-handoff.md` confirms done
- [ ] Backend tests green: `cd invoice-tool\packages\backend; npx jest --bail --no-coverage`
- [ ] Frontend build passes: `cd invoice-tool\packages\frontend; npx next build`
- [ ] Existing stubs exist: `src/app/products/page.tsx`, `src/app/exports/page.tsx`
- [ ] API client has: `listProducts()`, `syncProducts()`, `createExport()`, `downloadExport()`

**If any check fails → STOP. Fix before proceeding.**

---

## §1 Context

### Business Requirement
- **F10 — Product Catalog**: Sync Viettel products, search/browse catalog, show sync status
- **F11 — Export**: Export processed invoices to CSV/JSON with date/batch/schema filters
- **F12 — Diagnostics**: System health, processing stats, error monitoring

Reference: `tasks/01-business-spec.md` § F10, F11, F12

### Architecture Context
Frontend pages consuming existing REST API endpoints. No backend changes needed — all controllers/use cases already implemented in Sessions 8-9.

### Existing API Endpoints
| Endpoint | Client Method | Used On |
|----------|--------------|---------|
| GET /api/products | `apiClient.listProducts()` | Products page |
| POST /api/products/sync | `apiClient.syncProducts()` | Products page sync button |
| POST /api/exports | `apiClient.createExport()` | Export page |
| GET /api/exports/:id/download | `apiClient.downloadExport()` | Export page download |
| GET /api/health | `apiClient.getHealth()` | Diagnostics page |
| GET /api/batches | `apiClient.listBatches()` | Diagnostics stats |
| GET /api/invoices | `apiClient.listInvoices()` | Diagnostics stats |

### OS/Shell
- Windows 11, PowerShell
- Avoid `&&`, `grep -r`, bash-isms

---

## §2 Mandatory Reading

### Skills
1. `.agents/skills/frontend-component/skill.md` — Next.js page/component patterns
2. `.agents/skills/batch-implementation/skill.md` — implementing 3+ items in one session
3. `.agents/skills/quality-self-check/skill.md` — always

### Workflows
- `.agents/workflows/implement-page.md` — frontend page implementation

### Relevant Learned Rules
- **Data fetching**: `useState` + `useCallback` + `useEffect` pattern (Session 12 notes)
- **Toast pattern**: `{ message, type }` → auto-dismiss with `setTimeout`
- **Vietnamese text**: ALL strings from `VI` constants — no hardcoded text in JSX
- **CSS**: Add to `globals.css` — no inline styles except rare overrides
- **Status colors**: `var(--color-success)`, `var(--color-warning)`, `var(--color-error)`

---

## §3 Tasks (Ordered)

### Task 1: Add Vietnamese Constants for New Pages

**Type**: GREEN (implement)
**File**: `packages/frontend/src/lib/constants.ts`

**What to do**:
Add constants for products page, export page, and diagnostics page:

```typescript
// Add to VI.product:
product: {
  // existing...
  syncSuccess: 'Đồng bộ sản phẩm thành công',
  syncing: 'Đang đồng bộ...',
  noProducts: 'Chưa có sản phẩm nào',
  noProductsDesc: 'Đồng bộ sản phẩm từ Viettel để bắt đầu.',
  totalProducts: 'Tổng sản phẩm',
  activeProducts: 'Sản phẩm đang hoạt động',
  searchPlaceholder: 'Tìm theo tên hoặc mã SP...',
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
},

// Add to VI.export:
export: {
  // existing...
  noExports: 'Chưa có bản xuất nào',
  noExportsDesc: 'Tạo bản xuất dữ liệu đầu tiên.',
  creating: 'Đang tạo...',
  success: 'Tạo bản xuất thành công',
  downloadReady: 'Sẵn sàng tải xuống',
  selectFormat: 'Chọn định dạng',
  dateFrom: 'Từ ngày',
  dateTo: 'Đến ngày',
  filterByBatch: 'Lọc theo lô',
  filterBySchema: 'Lọc theo mẫu',
  records: 'bản ghi',
  fileSize: 'Dung lượng',
},

// NEW diagnostics section:
diagnostics: {
  title: 'Chẩn đoán hệ thống',
  systemHealth: 'Sức khỏe hệ thống',
  healthy: 'Hoạt động bình thường',
  unhealthy: 'Có vấn đề',
  totalBatches: 'Tổng lô',
  totalInvoices: 'Tổng hóa đơn',
  processingRate: 'Tốc độ xử lý',
  errorRate: 'Tỷ lệ lỗi',
  recentErrors: 'Lỗi gần đây',
  noErrors: 'Không có lỗi nào',
  serverStatus: 'Trạng thái server',
  databaseStatus: 'Trạng thái CSDL',
  apiLatency: 'Độ trễ API',
  lastChecked: 'Kiểm tra lần cuối',
  refreshStatus: 'Kiểm tra lại',
},
```

---

### Task 2: Products Page — Replace Stub

**Type**: GREEN (implement)
**File**: `packages/frontend/src/app/products/page.tsx`

**What to do**:
Replace stub with full product management page:
- Fetch products with `apiClient.listProducts()`
- Sync button calls `apiClient.syncProducts()` and shows result toast
- Search/filter by product name or code
- Display in premium table with status badges
- Show sync stats (total fetched, created, updated, conflicts)

**Components to create**:
1. `src/components/product/ProductTable.tsx` — table with skeleton loading
2. `src/components/product/SyncResultBanner.tsx` — result banner after sync

**Business rules**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Product search | Case-insensitive substring match on name + code | Empty query shows all |
| Active status | `isActive` boolean → green/gray badge | null = treat as active |
| Sync result | Show created/updated/conflicts counts | 0 conflicts = no warning |
| Last synced | `lastSyncedAt` → relative time or "Chưa đồng bộ" | null = never synced |

---

### Task 3: Export Page — Replace Stub

**Type**: GREEN (implement)
**File**: `packages/frontend/src/app/exports/page.tsx`

**What to do**:
Replace stub with export creation form + download:
- Format selector (CSV / JSON)
- Optional date range filter (dateFrom, dateTo)
- Optional batch/schema filter (dropdowns populated from API)
- Create export → show result with download button
- Download triggers `apiClient.downloadExport()` → creates blob URL → opens

**Components to create**:
1. `src/components/export/ExportForm.tsx` — form with format, date range, filters
2. `src/components/export/ExportResult.tsx` — display result with download link

**Business rules**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Format | 'csv' or 'json' — default csv | Must select one |
| Date range | Optional — if set, both dateFrom and dateTo required | dateTo >= dateFrom |
| Batch filter | Optional — dropdown from listBatches | Empty = all batches |
| Schema filter | Optional — dropdown from listSchemas | Empty = all schemas |
| File size | Display in KB/MB with `formatFileSize()` | 0 bytes = "0 B" |
| Download | Blob URL → `window.open(url, '_blank')` | Error → toast |

---

### Task 4: Diagnostics Page — New Page

**Type**: GREEN (implement)
**File**: `packages/frontend/src/app/diagnostics/page.tsx` (NEW)

**What to do**:
Create new diagnostics page:
- Health check (GET /api/health) with status indicator
- Processing statistics from batch/invoice counts
- System info cards (server status, API latency, etc.)
- Auto-refresh every 30 seconds
- Recent error summary

**Components to create**:
1. `src/components/diagnostics/HealthCard.tsx` — server health with pulse animation
2. `src/components/diagnostics/StatsGrid.tsx` — 4 stat cards (batches, invoices, processed, errors)

**Business rules**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Health check | GET /api/health → "ok" = green | Network error = red |
| Auto-refresh | `setInterval(30000)` → re-poll health + stats | Clear on unmount |
| Error rate | errors / total * 100 | Total = 0 → show "N/A" |
| Processing rate | completed today / total today * 100 | No data today → 0% |

---

### Task 5: Add Route + Navigation for Diagnostics

**What to do**:
- Add diagnostics route to sidebar navigation
- Update `getPageTitle()` in AppShell for diagnostics route

**Sidebar change** (in `Sidebar.tsx`):
Add to "Báo cáo" section:
```typescript
{ href: '/diagnostics', icon: '🔧', label: VI.nav.diagnostics },
```

**Constants change**: Add `diagnostics: 'Chẩn đoán'` to `VI.nav`

---

### Task 6: CSS Styles for New Pages

**File**: `packages/frontend/src/app/globals.css`

**What to do**: Add CSS for:
- Products table with search bar and sync button styling
- Export form with format selector cards, date inputs
- Diagnostics health card with pulse animation, stat grid
- Sync result banner with success/warning variants
- Export result card with download button

---

## §4 Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r`.

```powershell
# 1. Backend still green
cd c:\htdocs\viettel-ocr\invoice-tool\packages\backend
npx tsc --noEmit
npx jest --bail --no-coverage

# 2. Frontend builds
cd c:\htdocs\viettel-ocr\invoice-tool\packages\frontend
npx next build

# 3. Manual check: verify pages render
# - http://localhost:3001/products → product table or empty state
# - http://localhost:3001/exports → export form
# - http://localhost:3001/diagnostics → health check + stats
```

---

## §5 Acceptance Criteria

1. [ ] Products page shows product table with search/filter
2. [ ] Sync button triggers sync and shows result toast with counts
3. [ ] Export form allows format selection + optional filters
4. [ ] Export creates job and offers download link
5. [ ] Diagnostics page shows health status with auto-refresh
6. [ ] Diagnostics shows processing stats (batches, invoices, errors)
7. [ ] Diagnostics route exists in sidebar navigation
8. [ ] `npx next build` passes with 0 errors
9. [ ] All Vietnamese text from `VI` constants (no hardcoded strings)
10. [ ] CSS uses existing design tokens (colors, spacing, animations)

---

## §6 Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Products + Export + Diagnostics pages
   - Found: Any surprises
   - What's Next: "Session 15: SSE integration + setup/start scripts + E2E"

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Any new frontend patterns learned

3. Update `tasks/progress.md`:
   - Mark 4.7, 4.8, 4.9 as ✅ Done
   - Update session log

**Next session depends on**: All 3 pages working + frontend build passing
