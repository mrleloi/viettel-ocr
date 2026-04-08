# Progress Tracker

> Last updated: 2026-04-08 (Phase 2 COMPLETE, Session 26 done)

## Phase 1: Foundation & Domain Core ✅ COMPLETE

| Step | Description | Status | Session | Notes |
|------|------------|--------|---------|-------|
| 1.1 | Project scaffolding | ✅ Done | 1 | All 4 packages, 17 DB tables defined |
| 1.2 | Domain entities & value objects | ✅ Done | 2 | 3 VOs + 8 entities, 140 tests |
| 1.3 | Repository interfaces | ✅ Done | 3 | 8 interfaces created |
| 1.4 | Domain services (Fingerprint, Validator, Confidence, FuzzyMatcher, PromptBuilder) | ✅ Done | 3-4 | 5/5 services, 193 total tests |

## Phase 1: Infrastructure & Application ✅ COMPLETE

| Step | Description | Status | Session | Notes |
|------|------------|--------|---------|-------|
| 2.1 | Database repos (Drizzle implementations) | ✅ Done | 5 | 8 repos + 53 integration tests, 246 total |
| 2.2 | External integrations (Gemini, Viettel, FileStorage) | ✅ Done | 6 | 3 port interfaces + 3 implementations + 32 tests, 278 total |
| 2.3 | Job Queue | ✅ Done | 7 | SqliteJobQueue + QueueWorker, 24 tests |
| 2.4a | Upload + Processing use cases | ✅ Done | 7 | UploadBatch + ProcessInvoice, 20 tests |
| 2.4b | Remaining use cases (Schema, Review, Export) | ✅ Done | 8 | 8 use cases, 39 tests |

## Phase 1: Interface Layer (API) ✅ COMPLETE

| Step | Description | Status | Session | Notes |
|------|------------|--------|---------|-------|
| 3.1 | Controllers + DTOs + OpenAPI | ✅ Done | 9 | 7 controllers, 17 DTOs, 30 tests |
| 3.2 | OpenAPI client generation + typed API client | ✅ Done | 10 | Typed `apiClient` with 17 methods |

## Phase 1: Frontend ✅ COMPLETE

| Step | Description | Status | Session | Notes |
|------|------------|--------|---------|-------|
| 4.1 | Layout & navigation | ✅ Done | 10 | AppShell + sidebar + header + 7 routes |
| 4.2 | Dashboard page | ✅ Done | 11 | StatCard + RecentBatchesTable + ActivityFeed, real API data |
| 4.3 | Upload page | ✅ Done | 11 | FileDropzone + UploadResult, drag & drop, progress bar |
| 4.4 | Review queue + detail | ✅ Done | 12 | ReviewFilter + InvoiceTable + RejectDialog + detail page |
| 4.5 | Schema management | ✅ Done | 13 | Schema list + wizard + detail + inline editing |
| 4.6 | Mapping management | ✅ Done | 13 | Mapping table + filter + create dialog |
| 4.7 | Product management | ✅ Done | 14 | Product table + sync + search + result banner |
| 4.8 | Export page | ✅ Done | 14 | Export form + format cards + result + download |
| 4.9 | Diagnostics page | ✅ Done | 14 | Health card + pulse animation + stats grid + auto-refresh |
| 4.10 | SSE integration | ✅ Done | 15 | EventBusService + EventsController + useServerEvents hook + Dashboard live badge |

## Phase 1: Integration & Polish (partial)

| Step | Description | Status | Session | Notes |
|------|------------|--------|---------|-------|
| 5.1 | E2E testing | ✅ Done | 15 | 8-step full flow: health → upload → list → approve → export |
| 5.2 | Setup script | ✅ Done | 15 | Node.js version check, deps, config, data dirs, shared build |
| 5.3 | Start script | ✅ Done | 15 | Concurrent backend + frontend + mock server, graceful shutdown |
| 5.4 | Config validation | ⬜ Deferred | — | Deferred to Phase 2 polish |
| 5.5 | Error handling polish | ⬜ Deferred | — | Deferred to Phase 2 polish |
| 5.6 | Performance testing | ⬜ Deferred | — | Deferred to Phase 3 |

---

## Phase 2: Depth over Breadth (Sessions 16–26)

> **Master Plan**: `tasks/09-phase2-master-plan.md`
> **Focus**: Finish Phase 1 spec gaps per 9 user-reported issues
> **Target**: ≥480 tests, all F01-F11 spec rows ✅

### 2.A — Foundation & Notifications (Sessions 16–18)

| Step | Description | Status | Session | Issues | Notes |
|------|------------|--------|---------|--------|-------|
| 2.A.1 | Nav fixes, sidebar badge, product sync mock | ✅ Done | 16 | #1, #2, #8 | 407 tests, batch detail page added |
| 2.A.2 | Notification domain + backend | ✅ Done | 17 | #3 | 455 tests, full vertical slice |
| 2.A.3 | Notification frontend (bell + SSE) | ✅ Done | 18 | #3 | Bell dropdown, SSE real-time |

### 2.B — Intake Depth (Session 19)

| Step | Description | Status | Session | Issues | Notes |
|------|------------|--------|---------|--------|-------|
| 2.B.1 | Duplicate policy + reprocess | ✅ Done | 19 | #4 | 477 tests, resumeForReprocess + DuplicatePolicy + reprocess API + frontend |

### 2.C — Review Depth (Sessions 20–21)

| Step | Description | Status | Session | Issues | Notes |
|------|------------|--------|---------|--------|-------|
| 2.C.1 | Invoice DTO expansion + file/trace endpoints | ✅ Done | 20 | #6 | 498 tests, ProcessingTrace entity+repo, InvoiceResponseDto 20+ new fields, GET /file + GET /traces endpoints |
| 2.C.2 | PDF viewer + verification UI + batch detail | ✅ Done | 21 | #6 | Two-column review page, PDF viewer, LineItemsTable, ConfidenceBreakdown, ValidationPanel, TraceTimeline + 600 CSS |

### 2.D — Schema Depth (Sessions 22–24)

| Step | Description | Status | Session | Issues | Notes |
|------|------------|--------|---------|--------|-------|
| 2.D.1 | Field-def/fingerprint CRUD + schema preview | ✅ Done | 22 | #7, #9 | 522 tests, field/rule CRUD + PreviewSchemaExtractionUseCase |
| 2.D.2 | 7-step schema wizard rewrite | ✅ Done | 23 | #7 | API client +9 methods, 7-step wizard, field/rule CRUD in detail page |
| 2.D.3 | Auto-create-schema + create-from-review | ✅ Done | 24 | #5 | 527 tests, maybe_create_schema stage + upload checkbox + review create-schema btn |

### 2.E — Catalog & Output Polish (Sessions 25–26)

| Step | Description | Status | Session | Issues | Notes |
|------|------------|--------|---------|--------|-------|
| 2.E.1 | Product conflicts + mappings from review | ✅ Done | 25 | #8, #9 | 533 tests, GET/POST conflicts, CreateMappingDialog pre-fill, LineItemsTable + Ánh xạ btn |
| 2.E.2 | Filtered exports + batch export | ✅ Done | 26 | — | 538 tests, findByFilters + statusFilter + batch export btn |

---

## Metrics

| Metric | Phase 1 Final | Phase 2 Target |
|--------|--------------|----------------|
| Domain tests | 193 | ~220 |
| Infrastructure tests | 109 | ~130 |
| Application tests | 59 | ~80 |
| Interface tests | 37 | ~50 |
| E2E tests | 8 | ~15 |
| Total tests | 406 | ≥480 (current: 538) |
| Total source files | ~150 | ~200 |
| Sessions completed | 15 | 26 |

## Session Log

| # | Date | Agent | Done | Found | Pending |
|---|------|-------|------|-------|---------|
| — | 2026-04-07 | Claude (Planning) | All 8 design docs + agent config | — | Session 1: scaffolding |
| 1 | 2026-04-07 | Antigravity | Monorepo + 4 packages + DB schema + config | 7 npm audit vulns (non-blocking) | Session 2: domain entities |
| 2 | 2026-04-07 | Antigravity | 3 VOs + 8 entities + 140 domain tests all green | — | Session 3: repo interfaces + domain services |
| 3 | 2026-04-07 | Antigravity | 8 repo interfaces + FingerprintService + ValidatorService (163 tests) | Jest 30/ts-jest 29 incompatibility | Session 4: remaining domain services |
| 4 | 2026-04-07 | Antigravity | ConfidenceCalculator + FuzzyMatcher + PromptBuilder (193 tests) | Composite scoring behavior, test assertion patterns | Session 5: database repos |
| 5 | 2026-04-07 | Antigravity | 8 Drizzle repos + test helper + NestJS module wiring (246 tests) | FK constraints in tests, table name matching | Session 6: external integrations |
| 6 | 2026-04-07 | Antigravity | 3 domain ports + GeminiClient + ViettelProductClient + LocalFileStorage + 3 NestJS modules (278 tests) | ConfigModule @Global + class injection, fake timer issues | Session 7: job queue + use cases |
| 7 | 2026-04-07 | Antigravity | IJobQueue + SqliteJobQueue + UploadBatch + ProcessInvoice + QueueWorker + 2 modules (322 tests) | LineItemProps vatRate fields, stateless domain services pattern | Session 8: remaining use cases |
| 8 | 2026-04-07 | Antigravity | 8 use cases (Approve/Reject/Edit/CreateSchema/UpdateSchema/SyncProducts/CreateMapping/CreateExport) + ApplicationModule (361 tests) | InvoiceType typed union, Product.markSynced arg | Session 9: REST controllers |
| 9 | 2026-04-07 | Antigravity | 7 controllers + 17 DTOs + InterfaceModule + 30 controller tests (391 tests) | supertest default import, overallConfidence getter, global prefix | Session 10: OpenAPI client + frontend |
| 10 | 2026-04-07 | Antigravity | Swagger/OpenAPI + API client + layout + sidebar + header + 7 route stubs (391 tests) | Tailwind CSS v4 already configured, Next.js rewrites | Session 11: dashboard + upload |
| 11 | 2026-04-07 | Antigravity | Dashboard (3 components) + Upload (2 components) + 550 CSS lines (391 tests) | API proxy fails gracefully without backend, shimmer loading | Session 12: review pages |
| 12 | 2026-04-07 | Antigravity | Review queue + invoice detail + 3 components + 590 CSS lines (391 tests) | Dialog/modal pattern, inline editing, dynamic routes | Session 13: schema + mapping pages |
| 13 | 2026-04-07 | Antigravity | Schema (list+wizard+detail) + Mapping (table+dialog) + 860 CSS + backend DI/migration fixes (391 tests) | forwardRef circular dep, auto-migration DDL, full-stack working | Session 14: products + export + diagnostics |
| 14 | 2026-04-07 | Antigravity | Products (table+sync+search) + Exports (form+result+download) + Diagnostics (health+stats+auto-refresh) + 1036 CSS (391 tests) | No backend changes needed, all APIs already existed | Session 15: SSE + E2E + scripts |
| 15 | 2026-04-07 | Antigravity | SSE (EventBus+Controller+hook) + E2E (8-step flow) + seed script + setup/start improvements (406 tests) | NestJS @Sse works with RxJS Subject, POST returns 201 by default | **PHASE 1 MVP COMPLETE** |
| — | 2026-04-08 | Config update | Phase 2 agent configs updated for sessions 16–26 | — | Session 16: nav fixes + sidebar badge + product sync |
| 16 | 2026-04-08 | Antigravity | Sidebar live badge + dashboard row click + batch detail page + product sync mock fix (407 tests) | — | Session 17: notification domain + backend |
| 17 | 2026-04-08 | Antigravity | Notification entity + repo + 3 use cases + controller + DTOs + SSE event + hooks in Upload/Process/Sync (455 tests) | @Optional() DI for notification hooks, EventBusService string token alias | Session 18: notification bell + frontend |
| 18 | 2026-04-08 | Antigravity | NotificationBell component + useNotifications hook + API client methods + SSE wiring + 230 CSS lines (455 tests) | Plain hooks over Zustand, badge hidden at 0 | Session 19: duplicate policy + reprocess |
| 19 | 2026-04-08 | Antigravity | resumeForReprocess() + ReprocessInvoiceUseCase + DuplicatePolicy (skip/process_anyway/flag_only) + reprocess endpoint + upload policy UI + review reprocess btn (477 tests) | NotificationCategory must use valid values, E2E needs all controller deps | Session 20: invoice DTO expansion + file/trace endpoints |
| 20 | 2026-04-08 | Antigravity | ProcessingTrace entity+repo + InvoiceResponseDto expanded (20+ new fields) + GET /file + GET /traces endpoints + frontend types updated (498 tests) | toResponseDto must handle JSON.parse safely, IFileStorage DI needed for InvoiceController | Session 21: review frontend depth |
| 21 | 2026-04-08 | Antigravity | Two-column review page (PDF viewer + tabbed data), LineItemsTable, ConfidenceBreakdown (per-field bars), ValidationPanel, TraceTimeline + 600 CSS lines (498 tests) | iframe PDF viewer vs react-pdf, sticky PDF panel, tab responsiveness | Session 22: schema backend depth |
| 22 | 2026-04-08 | Claude Code | Fixed schema.controller.spec (6 broken tests), field/rule CRUD tests (16 new), PreviewSchemaExtractionUseCase + tests (6), preview endpoint (3 tests) — 522 total | outputKey already in schema; inline file type; @HttpCode(200) for preview | Session 23: 7-step schema wizard |
| 23 | 2026-04-08 | Claude Code | 7-step schema wizard (api-client +9 methods, constants +30 keys, wizard rewrite ~350 lines, detail page + field/rule CRUD, 200 CSS lines) — 522 tests unchanged | Frontend-only session; `as const` with readonly array needs type assertion | Session 24: auto-create-schema + create-from-review |
| 24 | 2026-04-08 | Claude Code | maybe_create_schema pipeline stage tests (+5), upload page auto-create checkbox, api-client param, review "Create schema" button — 527 tests | Backend stage was pre-implemented; 5→6 stages fix; @Optional inject pattern | Session 25: product conflicts + mappings from review |
| 25 | 2026-04-08 | Claude Code | GET/POST conflict endpoints + 6 new tests, CreateMappingDialog preFilledPartnerProductName prop, conflicts page, LineItemsTable + Ánh xạ btn, review page CreateMappingDialog wiring — 533 tests | ISyncConflictRepository already in @Global() DatabaseModule; no module changes needed | Session 26: filtered exports + batch export |
| 26 | 2026-04-08 | Antigravity | findByFilters repo method + statusFilter DTO/use-case + fixed no-batchId path + status dropdown in ExportForm + batch export button — 538 tests | 5 mock files needed findByFilters added; reject() takes 1 arg | **PHASE 2 COMPLETE** |
