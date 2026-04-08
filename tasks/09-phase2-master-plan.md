# Master Plan — Phase 2 (Depth over Breadth)

**Version**: 2.0
**Date**: 2026-04-08
**Status**: Planning
**Predecessor**: `tasks/08-master-plan.md` (Phase 1 MVP — feature-complete, 15 sessions)

---

## 0. Why Phase 2 exists

Phase 1 delivered breadth: every page in the sidebar renders, every REST endpoint exists, the pipeline runs end-to-end, 407 backend tests pass. But a first real-world walkthrough revealed that **most of the "depth" requirements from the business spec were silently dropped** or shipped as stubs. The sidebar has nine items; only three (upload, dashboard stats, review list) can be used without hitting a dead end.

Phase 2 is not a new feature wave. It's **finishing Phase 1 against its own spec**, plus closing the small number of genuine gaps the spec itself underspecified (points 5 and 9 below). Nothing in this plan is speculative — every task is either:

- (a) **spec-present, implementation-missing** — e.g. `F08` review screen with PDF viewer,
- (b) **spec-present, implementation-stub** — e.g. `F05` schema wizard only has 2 of 7 steps,
- (c) **bug / regression** — e.g. dashboard rows not clickable, sidebar badge hardcoded to `0`,
- (d) **spec-ambiguous, decision needed** — 2 items, called out explicitly.

---

## 1. Issue-by-issue analysis (user feedback 2026-04-08)

Each item below: **what the user observed → what the spec says → what the code actually has → classification → where it lands in the phase plan.**

### Issue 1 — Dashboard "recent batches" rows are not clickable

**User**: "từ trang tổng quan, danh sách lô hóa đơn gần đây, click vào item thì không chuyển đến trang detail"

**Spec** (`F09`, §3.9): Dashboard lists recent batches; each row navigates to a batch detail view. Per-invoice trace screen also described ("Click vào bất kỳ invoice → xem full trace").

**Current code** (`components/dashboard/RecentBatchesTable.tsx:106`): Rows carry `className="clickable-row"` but no `onClick` handler. There is **no batch detail route** at all (`app/batches/[id]/page.tsx` does not exist).

**Classification**: (a) spec-present, implementation-missing. Two gaps:
1. Click handler on the row.
2. The destination page (`/batches/[id]`) doesn't exist.

**Where it goes**: Phase 2.A (Navigation & nav-state fixes) for the click, Phase 2.C (Review depth) for the destination page (batch detail reuses most of the invoice detail layout — see Issue 6).

---

### Issue 2 — "Kiểm duyệt" sidebar badge is wrong

**User**: "thanh menu left, badge tại 'kiểm duyệt' đang hiển thị sai"

**Spec** (`F09`, §3.9 Dashboard): Notification bell with badge count, dashboard cards reflecting `pendingReview`. Sidebar badge is implied by the nav pattern — operator should see outstanding work without clicking into the page.

**Current code** (`components/layout/Sidebar.tsx:86`): `<span className="nav-item-badge">0</span>` — **literal string "0", never bound to state**. The real `needs_review` count already comes back from `GET /api/invoices?status=needs_review`, which the dashboard page fetches and throws away when navigating away.

**Classification**: (c) regression/bug. Three-line fix conceptually, but needs a shared store so the sidebar doesn't re-fetch on every route change.

**Where it goes**: Phase 2.A, bundled with the notification work (Issue 3) since both read from the same polling/SSE source.

---

### Issue 3 — Notifications don't work

**User**: "notify đang chưa hoạt động"

**Spec** (`F09`, §3.9): "In-app notification bell với badge count. Click notification → navigate trực tiếp đến item/queue tương ứng. Notification types: error, warning, info."

**Current code**:
- DB table `notifications` exists (`infrastructure/database/schema.ts:195`) with `category | title | message | relatedEntityType | relatedEntityId | isRead | createdAt`.
- **No domain entity, no repository, no use case, no controller, no emitter**. The table was created in Session 1 and never touched again.
- Header bell (`components/layout/Header.tsx:41`) has a hardcoded `<span className="badge animate-pulse" />` — no count, no dropdown, no click handler.

**Classification**: (a) spec-present, implementation-missing — biggest gap of all nine items. Needs full vertical slice: domain → repo → use case (emit-on-event) → controller → SSE push → frontend dropdown.

**Where it goes**: Phase 2.A (notification MVP: duplicate, mapping-unmapped, schema-conflict, error events).

---

### Issue 4 — Duplicate handling is opaque and non-configurable

**User**: "nếu trùng file, đang báo là 'Đã nhận 0/1 file — 1 trùng'. cần phải cho phép người dùng tiếp tục xử lý với file trùng hoặc bỏ qua file trùng... được phép xử lý lại, ví dụ đổi workflow sau khi process hay model thì sao... và hơn nữa, khi vào tab kiểm duyệt, vẫn có 1 dòng record với trạng thái 'trùng lặp' xuất hiện nhưng không chứa thông tin? rất confusing."

**Spec** (`F11`, §3.11): Duplicate detection produces a warning with link to the original record. Operator options: **"Skip (trùng thật)" / "Process anyway (HĐ điều chỉnh)" / "Flag & skip"**. The behavior the user is describing is literally the one in the spec — the MVP shipped only "auto-skip" as the default and nothing else.

Additional user ask: **reprocess** an already-processed invoice under a different workflow/model. Not in the original spec but highly consistent with §3.6 and §3.13 (Configurator needs to iterate on schemas and confidence).

**Current code**:
- `UploadBatchUseCase.execute` (`application/upload/upload-batch.use-case.ts:126-145`) always marks duplicates as `duplicate` and saves them — never enqueues.
- There is no "force process" or "ignore duplicate" flag on the upload DTO.
- `Invoice` entity has a `markAsDuplicate(duplicateOfId)` transition but no `resume`/`reprocess` transition.
- The duplicate row showing up in `/review` with "không chứa thông tin" is correct given the code — it's a blank `Invoice.create()` with only `duplicateOfId`, no extracted data, status `duplicate`. The review list filter (`status=needs_review` on the dashboard, `all` on review) shows it anyway.

**Classification**:
- (b) spec-present, implementation-stub for the "skip/process anyway" choice.
- (d) spec-ambiguous for reprocess — we'll decide: yes, add it; scope limited to "re-run the pipeline on the existing file, keep the old invoice row".

**Where it goes**: Phase 2.B (Intake depth) — one session covering upload flow UX + backend duplicate-policy flag + reprocess use case + review-queue filtering for `duplicate` status.

---

### Issue 5 — Auto-create schema on new pattern detection

**User**: "sau khi tải file lên ở chế độ schema là 'tự động nhận dạng', thì nếu là pattern mới thì sao? phải cho phép người dùng default checkbox vào 'tự động tạo mẫu hóa đơn mới nếu phát hiện', rồi backend nếu tìm thấy đây là một mẫu hóa đơn mới, sẽ tự động tạo luôn, chỉ thông báo kết quả cho người dùng. nếu không tick checkbox này mà phát hiện mẫu hóa đơn mới, xếp vào danh sách cần kiểm duyệt. khi đó từ màn hình kiểm duyệt sẽ cho phép tạo mẫu hóa đơn mới từ kết quả."

**Spec** (`F03` §3.3, `F05` §3.5): Spec routes `New/Unknown` to Configurator review queue. It describes a wizard for schema creation but **does not mention automatic schema creation from detection**. The closest is the decision matrix row `Mixed batch + No match → 🤖 Gọi LLM classify` — still just classification, not schema creation.

**Current code**:
- `ProcessInvoiceUseCase` falls back to LLM classification, and if still no match, proceeds with a generic prompt and marks the invoice for review. No path creates a schema.
- No `auto_create_schema_on_new_pattern` field on Batch or upload DTO.
- There is a `CreateSchemaUseCase` that could be invoked programmatically.

**Classification**: (d) spec-ambiguous — new capability. Auto-creation is a reasonable extension of the "Configurator review" path but introduces new risks (schema pollution, duplicate/near-duplicate schemas). Decision: **opt-in only, default OFF**; auto-created schemas start in `draft` status so Configurator must approve before they become active.

The manual path ("create schema from review screen") also doesn't exist today — the review detail page has no "create schema from this invoice" action. That's part of the same slice.

**Where it goes**: Phase 2.D (Schema depth) — one session adding: upload checkbox, batch-level flag, pipeline stage "maybe-create-schema", "Create schema from this invoice" action on review detail.

---

### Issue 6 — No real review detail / verification view

**User**: "vì chưa có trang detail để xem kết quả upload, nên các flow quan trọng như compare file upload lên (pdf, xml, etc...) và kết quả ocr (kết quả raw từ ai model, và kết quả nếu có sau phân loại), từ đó mới xem được confident score có chính xác không... hiện tại chỉ vào xem được từ màn hình review, click vào review detail, thì cũng chỉ xem được một số field trong dữ liệu trích xuất, không có thông tin nào thêm để xác minh. độ tin cậy có một record là 6%, cũng không biết được lý do tại sao, để xác nhận hay từ chối. mục đích của review chỉ nên là: một, gặp mẫu hóa đơn mới, human vào tạo mẫu hóa đơn mới. hai, ai trích xuất confident không đủ, human compare trực tiếp file đầu vào và kết quả trích xuất."

**Spec** (`F08` §3.8): The spec is **crystal clear** and includes an ASCII mockup — PDF viewer on the left, extracted data on the right, click-a-field-to-highlight-region, line items with mapping badges. Also `F09` §3.9: "Per-invoice tracing — click invoice → xem full trace: Upload → Preprocessing → OCR → Classification → Extraction → Validation → Matching → Action".

**Current code**:
- `InvoiceResponseDto` (`interface/http/dto/invoice-response.dto.ts`) exposes **only 19 scalar fields** — no `lineItems`, no `ocrRawText`, no `extractedRawJson`, no `fieldConfidences`, no `validationErrors`, no `storagePath`, no `classificationMethod`, no pipeline-stage log.
- `Invoice` entity **already stores all of this** (`ProcessInvoiceUseCase.mapOcrToExtractedData` at line 489 sets `ocrRawText`, `extractedRawJson`, `fieldConfidences`). It's just not exposed through the API.
- `app/review/[id]/page.tsx` renders 7 editable text fields and 5 metadata lines. No PDF viewer. No line items. No confidence breakdown. No download link for the original PDF.
- No file-serving endpoint — `/api/invoices/:id/file` doesn't exist, so even a naive PDF embed has nothing to point at.
- No `processing_traces` query endpoint (the DB table exists but is not wired).

**Classification**: (a) spec-present, implementation-stub. **This is the single largest gap in Phase 1.** User is right: review without evidence is not review.

**Where it goes**: Phase 2.C (Review depth) — the biggest phase. Two sessions:
- **2.C.1 Backend**: extend `InvoiceResponseDto`, add `GET /api/invoices/:id/file`, add `GET /api/invoices/:id/trace`, persist and expose per-field confidences and pipeline stages.
- **2.C.2 Frontend**: rewrite `review/[id]/page.tsx` with PDF viewer (`react-pdf` or `<iframe>`), side-by-side extracted data, line-items table, per-field confidence badges, validation errors panel, pipeline trace timeline.

---

### Issue 7 — Schema creation from uploaded sample is impossible

**User**: "mẫu hóa đơn, phải cho phép cả upload từ file lên chứ. từ file sau đó dùng lại flow ocr để lấy ra các thông tin cần thiết, rồi quyết định field nào là fingerprint chính và phụ, không phải nhất thiết luôn luôn cố định phải là 'tên ncc' hay 'mst' cho mọi hóa đơn, cần phải tùy chỉnh được."

**Spec** (`F05` §3.5): Spec describes a **7-step wizard**: Basic Info → Upload Samples → Interactive Field Mapper → Fingerprint Setup → Behavior → Test Run → Activate. Fingerprint rules are already a collection (`mst_exact | keyword_contains | symbol_regex | custom`), with priority ordering — the data model always supported arbitrary fingerprinting.

**Current code**:
- `app/schemas/new/page.tsx` has **2 steps**: Basic Info + Review. Done. No sample upload, no field mapper, no fingerprint UI, no test run.
- `FingerprintRule` entity + repository exist. `fingerprint_rules` table exists. No controller endpoint for fingerprint rule CRUD (`mapping.controller.ts` handles mappings, not fingerprint rules).
- `FieldDefinition` entity + repository + table exist. No controller endpoint.
- No endpoint to OCR-extract a sample file outside the normal upload pipeline.

**Classification**: (b) spec-present, implementation-stub. The whole backend skeleton is there but neither the API surface nor the wizard UI to use it.

**Where it goes**: Phase 2.D (Schema depth). Two sessions:
- **2.D.1 Backend**: add CRUD endpoints for `FingerprintRule` and `FieldDefinition` (scoped under schema), add `POST /api/schemas/:id/sample` that runs the OCR stage in preview mode and returns extracted fields without persisting an Invoice, add `POST /api/schemas/:id/test-run` for end-to-end dry run.
- **2.D.2 Frontend**: rewrite wizard to 7 steps; step 3 (field mapper) and step 4 (fingerprint setup) are the hard parts.

---

### Issue 8 — Products page empty, sync returns 500

**User**: "trang quản lý sản phẩm, đang chưa hiện sản phẩm nào, gọi api đồng bộ thì đang báo 500 error"

**Spec** (`F06` §3.6): "Manual: nút 'Sync Now' trên UI. Auto: configurable schedule (default: mỗi 6 giờ). API endpoint configurable trong config file. MVP: mock API server built-in, trả sample data."

**Current code** — this is a root-cause trace:
- `config.env` has `VIETTEL_PRODUCT_API_URL=` **empty string**.
- `EnvConfigService.useMockProductApi` (`infrastructure/config/env-config.service.ts:97`) returns `true` when the URL is empty — so **the config layer knows to use mock**.
- `ViettelProductClient` (`infrastructure/external-api/viettel-product.client.ts:66`) **ignores that flag completely** and does `fetch('/products?...')` with no host → browser-or-node URL parse error → thrown up the stack → 500.
- `mock-server` package exists (`packages/mock-server/src/main.ts`), listens on `:3002`, has a `products.json` fixture. It's started alongside backend by the monorepo `npm start` script — **but the backend client never talks to it** because the config URL is empty and the client doesn't look up the mock.

**Classification**: (c) bug — 10-line fix. Two options:
1. Set `VIETTEL_PRODUCT_API_URL=http://localhost:3002` in `config.env` (pragmatic).
2. Have `ViettelProductClient` short-circuit to `http://localhost:3002` when `useMockProductApi === true` (cleaner — no env edit needed).

Option 2 is the right one, plus a startup assertion that logs which endpoint is in use.

**Where it goes**: Phase 2.A (small bug cleanup), same session as dashboard-click + sidebar-badge + notifications skeleton. Single commit.

---

### Issue 9 — Mapping page is flat; should be field-by-field per schema

**User**: "trang ánh xạ sản phẩm đang thiết kế sai, chưa đúng yêu cầu ban đầu. từ mẫu hóa đơn sau đó mới ra được các field bên trong mẫu, rồi mới ra được các đặc tính của từng item, ví dụ như mã product hay tên product, là mapping theo field - by - field, với giao diện configurable linh hoạt."

**Spec** (`F07` §3.7): Product mapping scoped by `source_ncc_tax_id` (i.e. per supplier, which in our model == per Schema). Flow 2 in the spec: "From review queue: Operator gặp line item unmapped → forward to Configurator → Configurator create mapping ngay từ review screen". There's also implicit field-level mapping in `F05` §3.5 via the Interactive Field Mapper — that's a different kind of mapping (extraction field → standard invoice field).

The user is conflating two concepts and both are real:
1. **Line-item product mapping** — partner product name/code → Viettel product code. Scoped per schema. This is what the current `Mapping` entity represents.
2. **Schema field mapping** — extracted field (`"ma_hang"` on this schema) → canonical output key (`"product_code"`). This is configuration that belongs on the schema's field definitions, not in a separate global list.

**Current code**:
- `Mapping` entity = line-item mapping (partnerProductName, viettelProductCode, scoped by schemaId). That's concept #1, already implemented.
- `FieldDefinition` entity has no `outputKey` / `canonicalField` attribute. Concept #2 is not implemented anywhere.
- UI is a single flat list at `/mappings` — no way to see "mappings for schema X", and no field-level view at all. Navigation from a schema to its mappings doesn't exist.

**Classification**: (d) spec-ambiguous. Decision:
- **Rename** current `/mappings` to `/mappings/products`, keep the entity, but **move the entry point into the schema detail page** (`/schemas/[id]/mappings/products`). Configurator never thinks "I want to see all mappings system-wide"; they always think "what mappings does schema X have?".
- **Add** field-level mapping as a new concept: `FieldDefinition.outputKey: string | null` (e.g. `product_code`, `product_name`, `unit_price`, or a free-form custom key). Configure it in step 3 of the wizard (Issue 7) and on schema detail.

**Where it goes**: Phase 2.D (Schema depth) — same two sessions as Issue 7; the field mapper UI is literally the same screen.

---

## 2. Spec coverage matrix

Maps each Phase 1 feature to whether it's fully done, stub, or missing. This is the honest answer to "are we done with Phase 1?".

| ID | Feature | Status | Gap | Phase 2 covers? |
|----|---------|--------|-----|-----------------|
| F01 | Upload & preprocessing | ⚠️ Stub | No duplicate policy choice, no reprocess, no batch templates, single/mixed only (no "New/Unknown") | 2.B |
| F02 | OCR & extraction | ✅ Done | — | — |
| F03 | Classification & fingerprinting | ⚠️ Stub | Fingerprint rules exist in entity but no UI, no per-schema configurable rules at creation time | 2.D |
| F04 | Validation layer | ⚠️ Stub | Runs, but results are stored as a JSON blob and never shown to operator | 2.C |
| F05 | Schema management | ❌ Missing | Wizard is 2 of 7 steps, no sample upload, no field mapper, no fingerprint UI, no test run | 2.D |
| F06 | Viettel product master | ❌ Broken | Sync returns 500; page empty; no conflict resolution UI | 2.A (fix) + 2.E (conflict UI) |
| F07 | Mapping master | ⚠️ Stub | Flat list, not scoped to schema; no "from review" flow; no fuzzy match suggestions; no bulk import | 2.D + 2.C |
| F08 | Review queue & approval | ❌ Missing | No PDF viewer, no line items, no per-field confidence, no validation panel, no trace | 2.C |
| F09 | Dashboard & monitoring | ⚠️ Stub | Dashboard rows not clickable, sidebar badge dead, no notifications, no batch detail, no per-invoice trace | 2.A + 2.C |
| F10 | Export & post-processing | ⚠️ Stub | Works, but no filtered export, no "export from review" flow, no behavior-config triggered export | 2.E |
| F11 | Duplicate detection | ⚠️ Stub | Detects, but no operator choice, no link to original, no "process anyway" | 2.B |
| F12 | Adjustment/replacement invoices | ❌ Missing | No keyword detection, no UI linking to original | Deferred to Phase 3 (only keyword detection is a small add; UI can wait) |
| F13 | Confidence analytics | ❌ Missing | No per-schema trend dashboard, no alerts | Deferred to Phase 3 |

**Phase 2 scope**: finish F01, F03, F04, F05, F06, F07, F08, F09, F10 to spec. Defer F12, F13. That is still a lot — see §4 for phasing.

---

## 3. Non-goals (explicit)

Things Phase 2 will **not** touch, to keep scope honest:

- F12 (adjustment/replacement invoices) — keyword detection only, no UI.
- F13 (confidence analytics dashboard) — can reuse diagnostics page later.
- Batch templates (F01 "optional enhancement") — deferred.
- Shadow Mode / schema A-B testing (F05 advanced) — deferred.
- Bulk-import mappings from Excel (F07 flow 4) — deferred.
- Implicit-learning mapping from operator edits (F07 flow 5) — deferred.
- Webhook/ERP push (F10 future) — already deferred in Phase 1.
- User auth (out-of-scope per §5 of business spec).
- Backend test coverage for the new frontend components (frontend tests are still best-effort per `testing.md`).

---

## 4. Phase plan

Five sub-phases. Each sub-phase is 1–3 sessions. Total: **11 sessions**. Ordering is strict: earlier sub-phases unblock later ones.

```
2.A  Foundation fixes & Notifications             (3 sessions)
2.B  Intake depth: duplicates & reprocess         (1 session)
2.C  Review depth: PDF viewer, trace, validation  (2 sessions, biggest)
2.D  Schema depth: wizard, fingerprint, fields    (3 sessions)
2.E  Catalog & output polish                      (2 sessions)
```

### 2.A — Foundation & Notifications (Sessions 16–18)

Purpose: fix the "trivial" dashboard/nav bugs, ship the notification vertical slice, and fix the product sync 500. These are unblockers for every later phase because notifications and fresh badge counts are needed for 2.B–2.E.

| Session | Scope | Key files | Acceptance |
|---------|-------|-----------|------------|
| **16** | Nav & bug sweep | `components/layout/Sidebar.tsx` (live badge via `useQuery`), `components/dashboard/RecentBatchesTable.tsx` (onClick → `/batches/[id]` placeholder route), `infrastructure/external-api/viettel-product.client.ts` (fall back to `http://localhost:3002` when `useMockProductApi === true`), `env-config.service.ts` (log which product endpoint is used at startup) | Sidebar badge reflects real `needs_review` count; dashboard rows navigate; `POST /api/products/sync` returns 200 with mock data; products page lists mocks. |
| **17** | Notifications — domain + backend | New: `domain/notification/*` (entity, repo interface, enum of categories), `application/notification/*` (CreateNotification, MarkRead, ListNotifications use cases), `infrastructure/database/repositories/notification.repository.impl.ts`, `interface/http/notification.controller.ts`, hooks in `UploadBatchUseCase` (duplicate category), `ProcessInvoiceUseCase` (low-confidence category, error category), `SyncProductsUseCase` (conflict category). SSE: add `notification.created` event type to `event-bus.service.ts`. | RED: tests for emit-on-duplicate, emit-on-error, mark-as-read, list unread. GREEN: all new unit + integration tests pass; upload of a duplicate file creates one `notifications` row. |
| **18** | Notifications — frontend | `components/layout/Header.tsx` (bell dropdown with unread count, polling + SSE), `lib/api-client.ts` (notification methods), `lib/notification-store.ts` (Zustand store — tolerated here because it replaces multiple ad-hoc `useState` on the bell), `hooks/useNotifications.ts`. | Bell shows real unread count; clicking an item navigates to the related entity (invoice / schema / product); mark-as-read works; SSE push updates count without polling. |

**Gate to exit 2.A**: backend tests ≥ 425, frontend build green, manual smoke: upload a duplicate → bell badge ticks up, click → lands on the original invoice.

---

### 2.B — Intake depth (Session 19)

Purpose: make duplicate handling usable and give the operator the reprocess escape hatch.

| Session | Scope | Key files | Acceptance |
|---------|-------|-----------|------------|
| **19** | Duplicate policy + reprocess | `domain/invoice/invoice.entity.ts` (new transition `resumeForReprocess()` — only from `approved | rejected | error | duplicate` back to `pending`, wipes extracted data), `application/upload/upload-batch.use-case.ts` (honour new input fields `onDuplicate: 'skip' \| 'process_anyway' \| 'flag_only'`, default `skip`; when `process_anyway`, **do not** create a new Invoice — enqueue the existing one with a fresh pipeline run), new `application/processing/reprocess-invoice.use-case.ts`, `interface/http/batch.controller.ts` (upload DTO field), new `interface/http/invoice.controller.ts` endpoint `POST /api/invoices/:id/reprocess`, `app/upload/page.tsx` (radio: skip / process anyway / flag only), `app/review/[id]/page.tsx` ("Xử lý lại" button for terminal-state invoices). | RED: reprocess test, process-anyway test, duplicate-flagged test. GREEN: uploading the same file with `process_anyway` triggers a fresh pipeline run on the existing record; review list no longer shows empty-data "duplicate" rows unless explicitly filtered; from review detail, clicking "Xử lý lại" re-runs the pipeline and the status cycles correctly. |

**Gate to exit 2.B**: upload → duplicate → pick "process anyway" → same invoice re-extracted with the new model/prompt without creating a phantom row.

---

### 2.C — Review depth (Sessions 20–21)

Purpose: the single most-requested improvement. Make review a real verification surface.

| Session | Scope | Key files | Acceptance |
|---------|-------|-----------|------------|
| **20** | Review backend — expose everything the entity already stores | `interface/http/dto/invoice-response.dto.ts` (add `lineItems[]`, `ocrRawText`, `extractedRawJson`, `fieldConfidences`, `validationErrors`, `classificationMethod`, `classificationConfidence`, `storagePath`, `pageCount`, `fileHash`), `interface/http/invoice.controller.ts` (new `GET /api/invoices/:id/file` → `StreamableFile` of the original PDF; new `GET /api/invoices/:id/trace` → pipeline stage log from `processing_traces`), `application/processing/process-invoice.use-case.ts` (persist trace rows — currently only writes to in-memory `stages` array, throws them away), new `domain/processing/processing-trace.entity.ts` and repo. | RED: controller test for each new endpoint; trace-persistence test. GREEN: `GET /api/invoices/:id` returns line items and raw OCR; the file endpoint streams the PDF; trace endpoint returns stage timings. |
| **21** | Review frontend — PDF viewer + evidence UI | Add `react-pdf` dependency (check AGENTS.md Next.js notes first). Rewrite `app/review/[id]/page.tsx` into a two-column layout: left = `<PdfViewer file={fileUrl} />`, right = tabs `Extracted / Line Items / Confidence / Validation / Trace`. New components: `components/review/PdfViewer.tsx`, `components/review/LineItemsTable.tsx`, `components/review/ConfidenceBreakdown.tsx` (per-field bars with the same 90/70/60 color bands as the spec), `components/review/ValidationPanel.tsx`, `components/review/TraceTimeline.tsx`. Also add a minimal `app/batches/[id]/page.tsx` that lists the invoices in the batch and reuses `InvoiceTable`. | Manual: open a 6%-confidence invoice → I can see which field dropped the score, read the exact validator rule that failed, compare against the PDF in the same viewport, decide approve/reject/edit. Batch-detail route is reachable from dashboard click. |

**Gate to exit 2.C**: a human can **answer "why is this 6%?"** without opening the database.

---

### 2.D — Schema depth (Sessions 22–24)

Purpose: finish `F05`, close Issue 7 and Issue 9.

| Session | Scope | Key files | Acceptance |
|---------|-------|-----------|------------|
| **22** | Schema backend — field-def / fingerprint CRUD + sample preview | New: `interface/http/dto/field-definition.dto.ts`, `interface/http/dto/fingerprint-rule.dto.ts`, endpoints under `schema.controller.ts`: `GET/POST/PUT/DELETE /api/schemas/:id/fields`, same for `/fingerprint-rules`. New use case `PreviewSchemaExtractionUseCase` + `POST /api/schemas/:id/preview` (accepts a PDF, runs the existing OCR stage with the schema's current field list, returns extracted fields **without** creating an Invoice or Batch). Add `outputKey: string | null` column to `field_definitions`. | RED: CRUD tests for both resources, preview test. GREEN: `tsc --noEmit && jest --bail` pass; fingerprint rules can be reordered by priority. |
| **23** | Schema wizard rewrite | Replace `app/schemas/new/page.tsx` with 7-step wizard matching `F05` §3.5: Basic → Upload Samples → Field Mapper (table of fields from OCR preview, each row: `displayName`, `dataType`, `required`, `outputKey`, `extractionHint`) → Fingerprint Setup (rule list, drag-to-reorder, add/remove) → Behavior Config (high/medium/low confidence actions) → Test Run (re-preview against the samples, show success rate) → Activate. Also `app/schemas/[id]/page.tsx` — add "Edit fields / rules" sections using the same sub-components. | Manual: upload a sample PDF → see fields extracted → mark invoice_number as required with outputKey=`invoiceNumber` → save → go to /upload → upload the same file → see it classify against the new schema via fingerprint. |
| **24** | Auto-create-schema-on-detect + "create from review" action | `domain/batch/batch.entity.ts` add `autoCreateSchemaOnNewPattern: boolean` field. `UploadBatchInput` / upload DTO accept the flag (default false). `ProcessInvoiceUseCase` add stage "maybe-create-schema": when classification returns no match AND the flag is set, instantiate a `draft` schema from extracted data and attach it. When flag is **not** set, emit a `schema_suggestion` notification (reuses 2.A). `app/review/[id]/page.tsx` — "Tạo mẫu hóa đơn mới từ hóa đơn này" button for invoices with `schemaId === null`. | RED: pipeline test for auto-create branch; pipeline test for suggestion branch. GREEN: upload with checkbox on → new schema created, status `draft`, linked to the invoice; upload with checkbox off → notification created, review screen shows the "create from this" action. |

**Gate to exit 2.D**: Configurator can onboard a new NCC end-to-end in one session without touching the DB.

---

### 2.E — Catalog & output polish (Sessions 25–26)

Purpose: close F06 (conflict resolution), F07 (mappings from review), F10 (filtered export). Cheapest sub-phase since backend entities mostly exist.

| Session | Scope | Key files | Acceptance |
|---------|-------|-----------|------------|
| **25** | Products conflicts + mappings from review | New `app/products/conflicts/page.tsx` driven by `SyncConflict` repo (already exists). Add `POST /api/products/conflicts/:id/resolve` (accept/ignore/manual). From review detail (`app/review/[id]/page.tsx`), add "Tạo mapping" action on each unmapped line item → opens the existing `CreateMappingDialog` pre-filled with `partnerProductName` and `schemaId`. | Manual: sync mock data twice after an edit → conflict appears → resolve → syncs clean. From review, create a mapping in two clicks. |
| **26** | Filtered exports + batch export from review | `app/exports/page.tsx` — wire the date/schema/status filters that are already on the form but are currently sent and then ignored by the controller. Add "Export this batch" action on `app/batches/[id]/page.tsx`. Extend `CreateExportUseCase` input with filter fields. | Manual: export `status=approved AND date>=X` → CSV contains only the intended rows. |

**Gate to exit 2.E**: every F01-F11 item in the spec coverage matrix is ✅ or (for the explicit deferrals) marked so.

---

## 5. Risk & dependency notes

- **Session 21 depends on the PDF-viewer library choice.** Next.js 16 with Turbopack may need `react-pdf` configured via a dynamic `next/dynamic` import to avoid SSR errors. Action guide for Session 21 must verify this against `packages/frontend/node_modules/next/dist/docs/` per the repo's `AGENTS.md` warning.
- **Session 17 introduces a new domain context (Notifications).** Drift risk: must go through `drift-check` after this session — the temptation is to plant notification logic inside existing use cases as side effects. The correct pattern is event-bus emit → notification use case consumes → repo persists.
- **Session 22 introduces a new schema column (`outputKey`).** The auto-migration path in `connection.ts` uses `CREATE TABLE IF NOT EXISTS`, which will **not** add a column to an existing table. Session 22 must either add an `ALTER TABLE` step or bump the test DB helper and document that the dev DB needs a `db-reset` run.
- **Session 19 reprocess transition** will break tests that rely on terminal-state invariants — expect 3–5 test updates in `invoice.entity.spec.ts`.
- **Sessions 20 and 22 both extend `InvoiceResponseDto` / new DTOs** — run them sequentially, not in parallel, to avoid `api-client.ts` merge pain.
- **No parallel session work.** Phase 1 was strictly sequential; Phase 2 should remain so. The dependency graph is: `16 → 17 → 18` (notifications), `16 → 19` (intake uses new notifications), `16 → 20 → 21` (review uses base fixes), `20 → 22 → 23 → 24` (schema wizard reuses review DTOs), `24 → 25 → 26`.

---

## 6. Definition of Done for Phase 2

Phase 2 is done when:

1. Every user-reported issue (1–9) is demonstrably fixed in a fresh Playwright walkthrough.
2. Spec coverage matrix (§2) shows no ⚠️ or ❌ in Phase-2 scope rows.
3. `npm test` (backend) ≥ 480 tests passing, no skipped tests added.
4. `next build` (frontend) green with no new warnings.
5. `drift-check.sh` clean — no domain→nest imports, no interface→domain shortcuts.
6. `smoke-test.ps1` green after every 2.A / 2.C / 2.D session (they all touch DI).
7. This file (`tasks/09-phase2-master-plan.md`) is updated with a "Done" column on every session row and `tasks/progress.md` has the new sessions logged.
8. `.context/session-handoff.md` and `.context/agent-notes.md` reflect the new state.

---

## 7. Session index (for future sessions to reference)

| # | Title | Phase | Action guide |
|---|-------|-------|--------------|
| 16 | ✅ Navigation fixes, sidebar badge, product sync mock | 2.A | `tasks/action-guides/s16-foundation-fixes.md` |
| 17 | ✅ Notification domain + backend | 2.A | `tasks/action-guides/s17-notifications-backend.md` |
| 18 | ✅ Notification bell + frontend wiring | 2.A | `tasks/action-guides/s18-notifications-frontend.md` |
| 19 | Duplicate policy + reprocess | 2.B | `s19-intake-depth.md` (TBD) |
| 20 | Invoice DTO expansion + file/trace endpoints | 2.C | `s20-review-backend.md` (TBD) |
| 21 | PDF viewer + verification UI + batch detail | 2.C | `s21-review-frontend.md` (TBD) |
| 22 | Field-def / fingerprint CRUD + schema preview | 2.D | `s22-schema-backend.md` (TBD) |
| 23 | 7-step schema wizard rewrite | 2.D | `s23-schema-wizard.md` (TBD) |
| 24 | Auto-create-schema + create-from-review | 2.D | `s24-schema-auto-create.md` (TBD) |
| 25 | Product conflicts + mappings from review | 2.E | `s25-catalog-polish.md` (TBD) |
| 26 | Filtered exports + batch export | 2.E | `s26-output-polish.md` (TBD) |

Action guides are created **before** each session by the Architect following the standard 7-section template and 11-point checklist from `.agents/skills/action-guide-creator/skill.md`.
