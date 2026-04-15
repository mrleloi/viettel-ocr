# Agent Notes (Persistent Memory)

> Invoice Processing Tool MVP. Updated: 2026-04-08 (Phase 1 complete, Phase 2 starting).

## Project Knowledge

- **Purpose**: Auto-process invoice PDFs via OCR + AI extraction + schema matching
- **Stack**: Next.js 14 + NestJS 10 + Drizzle + SQLite + Gemini Flash
- **Users**: ~5 (operators + configurators), localhost deployment
- **Volume**: ~1000 PDFs/day, ~10 invoice types
- **AI**: Gemini 2.0 Flash for OCR + extraction (~$3/day)
- **Architecture**: Clean Architecture + DDD, 7 bounded contexts (6 original + NOTIFICATION in Phase 2)

## Current Progress

- **Phase**: Phase 2 — Depth over Breadth (session 18 complete)
- **Phase 1**: ✅ COMPLETE (15 sessions, 406 tests, all pages functional)
- **Phase 2 Plan**: `tasks/09-phase2-master-plan.md` — 11 sessions (16–26), 5 sub-phases, 9 user-reported issues
- **Phase 2 Progress**: Sessions 16-18 ✅ (Issues #1, #2, #3, #8 fixed) — 2.A COMPLETE. Sessions 19-24 ✅ (Issues #4, #5, #7, #9 fixed). Session 25 ✅ (Issues #6, #7 partial — conflict UI + mapping from review done)
- **Domain entities**: 8 implemented (Invoice, Schema, FingerprintRule, FieldDefinition, Batch, Product, SyncConflict, Mapping) + 1 planned (Notification)
- **Value objects**: 3 implemented (TaxId, Money, Confidence)
- **Repository interfaces**: 8 created + 1 planned (INotificationRepository)
- **Repository implementations**: 8 Drizzle + SQLite repos
- **Domain services**: 5 implemented (FingerprintService, ValidatorService, ConfidenceCalculator, FuzzyMatcher, PromptBuilder)
- **External integrations**: 3 implemented (GeminiClient, ViettelProductClient, LocalFileStorage)
- **Domain port interfaces**: 4 (IOcrService, IProductApiClient, IFileStorage, IJobQueue)
- **Infrastructure services**: SqliteJobQueue, QueueWorkerService, EventBusService
- **Use cases**: 10 implemented (Upload, Process, Approve, Reject, Edit, CreateSchema, UpdateSchema, SyncProducts, CreateMapping, CreateExport) + ~6 planned for Phase 2
- **NestJS modules**: 8 (Config, Database, AI, ExternalApi, FileStorage, Queue, Application, Interface)
- **Controllers**: 7 (Health, Batch, Invoice, Schema, Mapping, Product, Export) + 1 planned (Notification)
- **DTOs**: 17 (8 input + 9 response) — Phase 2 will extend InvoiceResponseDto significantly
- **API endpoints**: 17 REST endpoints across 7 controllers + planned: file serve, trace, notification CRUD
- **Swagger UI**: `/api/docs` (dev mode only) — auto-generated from controller decorators
- **Frontend API client**: Typed `apiClient` with methods for all 17 endpoints
- **Frontend pages**: ALL 9 PAGES DONE (Phase 1). Phase 2 rewrites: review detail, schema wizard, mappings scoping
- **Frontend layout**: AppShell (collapsible sidebar + header) with Vietnamese labels, 12 routes
- **Frontend components**: 20+ components
- **Tests**: 533 total (backend)
- **Next session**: Session 26 — Filtered exports + batch export from review (Phase 2.E)

## Phase 2 Context (9 User-Reported Issues)

| # | Issue | Sub-Phase | Sessions |
|---|-------|-----------|----------|
| 1 | Dashboard rows not clickable | 2.A | 16 |
| 2 | Sidebar badge hardcoded to 0 | 2.A | 16 |
| 3 | Notifications don't work | 2.A | 17, 18 |
| 4 | Duplicate handling opaque, no reprocess | 2.B | 19 |
| 5 | Auto-create schema on new pattern | 2.D | 24 |
| 6 | No real review detail / verification view | 2.C | 20, 21 |
| 7 | Schema creation from uploaded sample impossible | 2.D | 22, 23 |
| 8 | Products page empty, sync 500 | 2.A + 2.E | 16, 25 |
| 9 | Mapping page flat, not field-by-field per schema | 2.D | 22, 23 |

## Phase 2 Risk Notes (from `09-phase2-master-plan.md §5`)

- **Session 19**: `resumeForReprocess()` transition will break 3–5 existing tests in `invoice.entity.spec.ts`
- **Session 21**: `react-pdf` with Next.js Turbopack may need `next/dynamic` import to avoid SSR errors
- **Session 22**: New `outputKey` column on `field_definitions` — `CREATE TABLE IF NOT EXISTS` won't add it
- **Sessions 20 & 22**: Both extend `InvoiceResponseDto` — run sequentially, never parallel
- **No parallel session work.** Dependency graph: `16→17→18`, `16→19`, `16→20→21`, `20→22→23→24`, `24→25→26`

## Bounded Contexts

| Context | Entities | Services | Status |
|---------|----------|----------|--------|
| INTAKE | Batch ✅, Invoice ✅ | FilePreprocessor, DedupChecker | Phase 2: add duplicate policy + reprocess (session 19) |
| PROCESSING | (uses Invoice ✅) | Pipeline, Classifier, Extractor, **ValidatorService ✅**, **ConfidenceCalculator ✅**, Router | Phase 2: add reprocess use case, maybe-create-schema stage |
| SCHEMA | Schema ✅, FingerprintRule ✅, FieldDefinition ✅ | **FingerprintService ✅**, **PromptBuilder ✅** | Phase 2: CRUD endpoints for fields/fingerprints, preview, wizard rewrite (sessions 22-24) |
| CATALOG | Product ✅, SyncConflict ✅, Mapping ✅ | SyncService ✅, **FuzzyMatcher ✅** | Phase 2: conflict resolution UI, mappings from review (session 25) |
| REVIEW | (uses Invoice ✅) | **Approve ✅**, **Reject ✅**, **Edit ✅** | Phase 2: PDF viewer, per-field confidence, trace timeline (sessions 20-21) |
| OUTPUT | Export ✅ | **CreateExport ✅** | Phase 2: filtered export, batch export (session 26) |
| **NOTIFICATION** | Notification ✅ | CreateNotification ✅, ListNotifications ✅, MarkNotificationRead ✅ | ✅ COMPLETE (sessions 17-18) — domain → repo → use cases → controller → SSE → bell UI |

## Learned Rules

### Architecture
- FingerprintService uses plain data interface `FingerprintRuleData` instead of entity directly — decouples service from entity internals
- ValidatorService uses `ExtractedInvoiceData` plain interface — not the Invoice entity
- Domain services are stateless: no constructor DI, receive all data as method parameters
- ConfidenceCalculator uses `ConfidenceInput` plain interface with all scoring factors
- FuzzyMatcher uses `ProductData` plain interface — not the Product entity
- PromptBuilder uses `SchemaData` and `FieldData` plain interfaces — not entity classes
- FuzzyMatcher composite scoring: 0.5 × Jaccard + 0.3 × LCS + 0.2 × brand_bonus — exact single-word match without brand = 0.8 (not 1.0)
- **Phase 2**: Notification creation MUST go through event-bus emit → NotificationUseCase pattern. NEVER create notifications as side effects inside existing use cases.
- **Phase 2**: `ALTER TABLE ADD COLUMN` needed when adding columns to existing tables (not just `CREATE TABLE IF NOT EXISTS`)
- **`outputKey` already in schema**: The `field_definitions` table had `output_key` from Phase 1 scaffolding — no migration needed for session 22
- **File upload inline type**: `{ originalname: string; buffer: Buffer; mimetype: string }` avoids @types/multer issues (same pattern as batch.controller.ts)
- **Preview-style POST**: No resource created → use `@HttpCode(200)` to avoid NestJS default 201

### NestJS / Drizzle
- **DI Token Convention**: Domain interface name as string token → `{ provide: 'ISchemaRepository', useClass: SchemaRepositoryImpl }`
- **Inject DB**: `@Inject(DATABASE_TOKEN)` (exported from `connection.ts`)
- **Upsert Pattern**: `db.insert(table).values(data).onConflictDoUpdate({ target: table.id, set: data })`
- **JSON Fields**: Store as TEXT with `JSON.stringify` on write, `JSON.parse` on read (e.g., lineItems)
- **Table names**: Drizzle `sqliteTable('name', ...)` uses the string arg as SQL table name — test DDL must match exactly
- **FK enforcement**: SQLite FK enabled via `sqlite.pragma('foreign_keys = ON')` — must set up parent records in tests
- **Test DB**: `createTestDb()` returns fresh in-memory SQLite with all tables — no cleanup needed
- **ConfigModule is @Global() + exports class directly** — use direct class injection, NOT `@Inject('string-token')` for EnvConfigService
- **NestJS module pattern**: Use `useExisting` to alias class to interface token: `{ provide: 'IOcrService', useExisting: GeminiClient }`

### Gemini API
- PromptBuilder produces system + extraction prompt pair
- Known schema mode: extraction-only with field list
- Unknown schema mode: classification section + standard fields
- Custom promptTemplate included if present, otherwise default

### Testing
- Jest 30 is not compatible with ts-jest 29 — must use Jest 29.x
- ts-jest max version is 29.4.9 (as of 2026-04)
- IDE may show "Cannot find module" and "implicit any" lint errors in test files but `tsc --noEmit` and `jest` both pass — these are IDE TS server lag artifacts
- `expect.stringContaining` inside `toContain()` doesn't work — use `array.some(p => p.includes(...))` pattern instead
- **Mock global.fetch pattern**: `const mockFetch = jest.fn(); (global as Record<string, unknown>).fetch = mockFetch;` — works for GeminiClient + ViettelProductClient
- **Fake timers + async retries are flaky** — use `createForTesting()` with 0ms baseDelay instead of fake timers
- **File storage tests**: Use `os.tmpdir()` + `fs.mkdtemp()` for isolated temp dir per test — clean up in afterEach
- Unused type imports (imported as values) cause TS6133 errors — only import types used in runtime expressions

### OS & Shell (CRITICAL)
- **OS**: Windows 11 — **Shell**: PowerShell
- **Bash `&&` does NOT work** in PowerShell. Use `;` or separate commands
- **Bash `grep -r`, `wc -l`** do NOT exist. Use `Select-String` or ripgrep `rg`, or use the `grep_search` tool
- **Bash `bash scripts/*.sh`** — won't run. Use `node` scripts or PowerShell equivalents
- Config docs (AGENTS.md, action guides, quality gates) use bash syntax — agent MUST translate to PowerShell

### Correct Test/Build Commands

| What | From monorepo root (`invoice-tool/`) | From backend (`packages/backend/`) |
|------|--------------------------------------|-------------------------------------|
| Run tests | `npm test` | `npx jest --bail` |
| TypeScript check | `npm run typecheck` | `npx tsc --noEmit` |
| Build | `npm run build` | `npx nest build` |

> ⚠️ **NEVER run `npx jest` from monorepo root** — no Jest config there, all suites will fail with "cannot transform TypeScript"
> The root `npm test` works because it delegates via `-w packages/backend`

### Session Management
- Always read session-handoff.md FIRST
- Always update agent-notes.md LAST
- "What's Next" must reference master plan verbatim
- Never invent session IDs — sessions 16–26 come from `09-phase2-master-plan.md` ONLY
- **Action Guide is MANDATORY** — check `tasks/action-guides/s{NN}-*.md` BEFORE any implementation
- If action guide missing → STOP → read `action-guide-creator/skill.md` → follow template with ALL 7 sections (§0-§6) → pass 11-point quality checklist → THEN implement
- At session END, create action guide for NEXT session following SAME template
- **Root cause of Session 1→2 gap**: Session 1 ran before r18-r20 existed. When Session 2 detected missing guide, agent created freeform notes instead of following the create-action-guide workflow/skill template. Fixed by inlining requirements into AGENTS.md r19 (7 sections, 11 checks, fresh-agent test).
- Guide must pass "fresh agent test": could an agent with ZERO prior context execute it?
- **MUST update `tasks/progress.md`** at session end — this was missed in Session 3 (caught in verification)
- **Root cause of test failure at verify**: `npx jest` at monorepo root has no Jest config → transform fails. Must use `npm test` (root) or `npx jest` (backend dir). All config docs use bash syntax which breaks on PowerShell.

### Use Case Patterns (Session 7)
- Use cases live in `src/application/{context}/` — one class per use case with `execute()` method
- Inject domain repos via DI tokens: `@Inject('IBatchRepository')`
- Domain services (FingerprintService, ValidatorService, ConfidenceCalculator, PromptBuilder) are **stateless** — instantiate directly in the use case constructor, NOT via NestJS DI
- Input/Output are **DTOs** (plain readonly objects), NOT entities
- Use cases orchestrate domain services + repos — no business logic inside use case
- Test use cases with **mocked repos/services** (unit tests), not integration tests

### Queue Patterns (Session 7)
- `IJobQueue` domain port in `domain/shared/job-queue.ts`; implementation in `infrastructure/queue/`
- SQLite-backed queue — NO Redis, NO BullMQ
- `BetterSQLite3Database<any>` needed for DI type compatibility
- QueueWorkerService uses `setInterval` polling with `processing` guard against concurrent execution
- Crash recovery: `resetStaleJobs()` on module init resets `processing` → `pending`

### NestJS DI Wiring Rules (Session 13 — CRITICAL)
> ⚠️ These rules were learned from 5 hidden DI bugs that accumulated across Sessions 5-9 without detection.
> Unit tests mock DI entirely, so they CANNOT detect missing module imports or unresolvable providers.

- **Module import completeness**: If `UseCaseX` depends on `@Inject('IFoo')`, the module providing `IFoo` MUST be imported by the module that provides `UseCaseX`
- **`@Global()` modules are the exception**: `DatabaseModule` and `ConfigModule` are `@Global()`, so their tokens are available everywhere without explicit import
- **Non-global modules that must be explicitly imported**: `FileStorageModule` (IFileStorage), `AiModule` (IOcrService), `ExternalApiModule` (IProductApiClient), `QueueModule` (IJobQueue)
- **Circular dependency**: If `ModuleA` imports `ModuleB` AND `ModuleB` imports `ModuleA`, use `forwardRef(() => ModuleX)` on BOTH sides, not just one
- **Primitive constructor params**: If a NestJS-managed service has number/string constructor params (not injected from DI), use `@Optional() @Inject('TOKEN_NAME')` with a value provider, or use `@Optional()` alone with a default value
- **Controllers injecting ports directly**: If a controller (not just use case) has `@Inject('IFoo')`, the controller's module must also import the module providing `IFoo`

### Database Auto-Migration (Session 13)
- `createDatabase()` in `connection.ts` MUST call `initializeTables()` with `CREATE TABLE IF NOT EXISTS` for ALL tables
- Test helper (`createTestDb()`) has its own DDL — but the production path (`createDatabase()`) also needs it
- When adding a new table to schema: update BOTH `initializeTables()` in `connection.ts` AND `createTestDb()` in test helper
- **Root cause**: 8 sessions passed with no tables in production DB because tests use in-memory DB with manual DDL
- **Phase 2 note**: Adding columns to existing tables requires `ALTER TABLE ADD COLUMN` — see `.claude/rules/architecture.md`

### Backend Smoke Test (Session 13)
- **`tsc --noEmit` + `jest --bail` are NOT sufficient** to verify backend health — they don't exercise the NestJS DI container at runtime
- **MUST run `smoke-test.ps1`** after ANY change to: `*.module.ts`, `@Inject()` decorators, or database schema
- Smoke test script: `scripts/smoke-test.ps1` — starts server, waits for "successfully started", kills, returns exit code
- Added to `complete-session.ps1` as Check 6 and to `quality-gate-pipeline.md` as Gate 1.5
- **Phase 2 DI-touching sessions**: 16, 17, 19, 20, 22, 24 — smoke test MANDATORY for these

### Type Gotchas (Session 7)
- `LineItemProps` (shared package) requires `vatRate: number | null`, `vatAmount: number | null`, `totalWithVat: number | null` — not just basic fields
- `name: string` (NOT nullable) in LineItemProps; use `''` as fallback
- `ClassificationMethod` type from shared package: `'frontend_hint' | 'fingerprint' | 'llm' | 'manual'`

### Type Gotchas (Session 8)
- `InvoiceType` typed union: `'original' | 'adjustment' | 'replacement'` — NOT free-form string
- `Product.markSynced(externalId: string)` — requires externalId argument
- `FingerprintRule` valid ruleTypes: `'mst_exact' | 'keyword' | 'symbol_regex' | 'custom'`
- `InvoiceProps` is a typed interface — cannot cast to `Record<string, unknown>` directly. Use getter properties instead
- When editing invoice extracted data: must call `setExtractedData()` then `markAsNeedsReview()` to preserve status
- `ExtractedDataProps.schemaId` is `string` (non-null) but `InvoiceProps.schemaId` is `string | null` — must provide fallback
- `ExtractedDataProps.classificationConfidence` is `number` not `number | null` — must provide fallback

### Interface Layer Patterns (Session 9)
- Controllers are THIN — delegate to use cases for mutations, direct repo inject for read-only GETs
- `app.setGlobalPrefix('api')` is set in `main.ts` — controllers use routes WITHOUT `api/` (e.g., `@Controller('batches')`, not `@Controller('api/batches')`)
- DTOs use `class-validator` decorators + `@nestjs/swagger` `ApiProperty`/`ApiPropertyOptional` decorators
- Install `class-validator` + `class-transformer` for DTO validation pipeline
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` set globally in `main.ts`
- `import request from 'supertest'` (default import) — NOT `import * as request` — `esModuleInterop: true` in tsconfig
- Invoice entity's confidence getter is `overallConfidence`, mapped to `confidenceScore` in response DTO
- `InterfaceModule` imports `ApplicationModule` for use case DI; `DatabaseModule` is `@Global()` so repo tokens available everywhere
- File download uses `StreamableFile` + `@Res({ passthrough: true })` pattern
- Controller test pattern: `Test.createTestingModule({ controllers: [...], providers: [mock use cases + mock repos] })`

### Frontend Patterns (Session 10)
- **Next.js 16.2.2** with Turbopack — builds in <1 second, dev server ready in ~450ms
- **Tailwind CSS 4** with `@tailwindcss/postcss` — uses `@theme inline {}` for CSS custom properties (NOT tailwind.config.js)
- **API proxy**: `next.config.ts` → `rewrites()` maps `/api/:path*` → `http://localhost:3000/api/:path*`
- **Typed API client** at `src/lib/api-client.ts` — generic `apiFetch<T>()` with ApiError class, typed methods for all endpoints
- **Vietnamese text**: All UI strings via `src/lib/constants.ts` `VI` constant object — NO hardcoded Vietnamese in JSX
- **Layout pattern**: AppShell (client component) wraps all pages → Sidebar + Header + `<main>` — state managed with `useState`
- **Sidebar**: collapsible with CSS transitions, active route detection via `usePathname()`, grouped nav sections
- **Route-to-title mapping**: `getPageTitle()` in AppShell maps pathname → Vietnamese page title for header
- **Page stubs**: Each route page is a server component with icon + title + description — to be replaced with real implementations
- **Frontend dev**: `npm run dev` (port 3001) | `npm run build` for production check | `npm run typecheck` for tsc
- **No React Query yet** — using `useState` + `useEffect` + `useCallback` for data fetching
- **No frontend tests yet** — manual verification via browser screenshots

### Frontend Patterns (Session 12)
- **Page data fetching pattern**: `useState` for data/loading/error → `useCallback(async () => { setLoading(true); try { ... } catch { setError(...) } finally { setLoading(false) } }, [deps])` → `useEffect(() => { fetch() }, [fetch])`
- **Filter integration**: active filter in state triggers re-fetch (include as dependency in `useCallback`)
- **Dialog/Modal pattern**: `RejectDialog` component with `open` prop, backdrop overlay `onClick={onClose}`, content `onClick={stopPropagation}`, `Escape` key handler
- **Inline editing pattern**: `editMode` boolean state → show inputs instead of display text → `editValues` Record<string, string> → compute diff on save
- **Toast pattern**: `{ message, type }` state → `setTimeout(() => setToast(null), 3000)` for auto-dismiss
- **Confidence formatting**: Score 0-1 → percentage with color coding (>=80% green, >=60% amber, <60% red)
- **Amount formatting**: `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`
- **Dynamic routes**: `/review/[id]/page.tsx` → `useParams()` to get `id`, `useRouter()` for navigation
- **CSS `@theme inline` warning**: IDE shows "Unknown at rule @theme" — false positive from CSS linter not understanding Tailwind 4, ignore safely

### Frontend Patterns (Session 14)
- **Product sync flow**: Sync button → `setSyncing(true)` → `apiClient.syncProducts()` → show `SyncResultBanner` with counts → refresh product list
- **Client-side search**: `useMemo` with case-insensitive filter on multiple fields (name + code + category) — no API call needed
- **Format selector cards**: Radio-like button group with `.active` class toggle — better UX than `<select>` for 2-3 options
- **File size formatting**: `formatFileSize(bytes)` — log-based unit selection (B/KB/MB/GB)
- **Relative time**: `formatRelativeTime(dateStr)` — "Vừa xong", "X phút trước", "X ngày trước", fallback to `toLocaleDateString`
- **Blob download**: `apiClient.downloadExport(id)` → `URL.createObjectURL(blob)` → `window.open(url, '_blank')`
- **Auto-refresh pattern**: `useRef<ReturnType<typeof setInterval>>` → `setInterval(30000)` → cleanup in `useEffect` return
- **Health check latency**: `performance.now()` before/after API call → round to integer ms
- **Diagnostics stats**: Compute from raw batch/invoice lists — no dedicated stats endpoint needed
- **Status bars with dynamic width**: `style={{ width: \`${pct}%\` }}` with `Math.max(pct, 2)` minimum
- **Empty state component**: Shared `.empty-state` CSS class with icon + title + desc — reusable pattern
- **No backend changes for 3 pages**: All API endpoints existed from Session 9 — frontend-only sessions are very fast
- **CSS organization**: ~1036 lines for 3 pages — keep page-specific CSS sections clearly separated with comment headers


## Excel Export Improvement (ad-hoc, 2026-04-15)

**User request (quote)**: "sửa lại tính năng xuất ra file excel, cải thiện format và cải thiện khả năng xuất nhiều kết quả trích xuất ra một lần vào luôn trong một sheet excel"

**Decisions**
- Chose `exceljs` over `xlsx` (SheetJS) — better styling API, Node-native, no licensing concerns.
- Two-sheet workbook (not single sheet): "Hóa đơn" (one row/invoice) + "Chi tiết hàng hóa" (one row/line item, keyed by invoiceId + invoiceNumber). Keeps header data scannable while preserving full line-item detail in one file.
- Made `xlsx` the DEFAULT format in ExportForm (was `csv`) — user explicitly asked to improve Excel.
- CSV kept but improved: `\uFEFF` BOM + CRLF line endings so Excel opens Vietnamese correctly.

**Key code locations**
- `packages/backend/src/application/export/create-export.use-case.ts` — new `serializeToXlsx`, `buildInvoiceSheet`, `buildLineItemSheet`, `styleHeaderRow`. `ExportFormat = 'csv' | 'json' | 'xlsx'`.
- `packages/backend/src/interface/http/dto/create-export.dto.ts` — `@IsEnum(['csv','json','xlsx'])`.
- `packages/backend/src/interface/http/export.controller.ts` — download loop tries `xlsx` first, MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `packages/frontend/src/components/export/ExportForm.tsx` — xlsx card first, default state `'xlsx'`.
- `packages/frontend/src/lib/constants.ts` — `VI.export.xlsx = 'Excel'`.

**Styling conventions used**
- Header row: bold white on `FF1F4E78` (dark blue), centered, height 22, frozen (`ySplit: 1`), autoFilter enabled.
- Currency format: `#,##0 "₫"`. Percent: `0.00"%"`. Date: `yyyy-mm-dd` (stored as JS `Date` object, not string).
- Invoice date serialization: `inv.invoiceDate ? new Date(inv.invoiceDate) : null` — Excel applies date cell format.

**Tests**
- 541/541 passing. Added 2: `should export approved invoices as XLSX workbook` (verifies ZIP magic bytes `PK\x03\x04`), `should download an XLSX export file with spreadsheet MIME type`.
- Updated existing `should throw for invalid format` test (was using `'xlsx' as 'csv'`; now uses `'pdf' as 'csv'`).
- Controller download test for CSV needed `mockImplementation((path) => path.endsWith('.csv') ? resolve : reject)` pattern because xlsx is now first in try-loop.

**Gotchas learned**
- `workbook.xlsx.writeBuffer()` returns `ArrayBuffer`-like — wrap in `Buffer.from(arrayBuffer as ArrayBuffer)` for IFileStorage.
- Header enum change in DTO is a semver-visible contract change (OpenAPI spec will show new `xlsx` value).

## Excel Export — Combined Sheet + Windows Launcher (2026-04-15, follow-up)

**User requests (quotes)**
1. "thêm một sheet tổng hợp vào đầu nữa, chứa đầy đủ cả thông tin hóa đơn và chi tiết hàng hóa trong một sheet luôn"
2. "cho một file script chạy được trên windows ở \"C:\\htdocs\\viettel-ocr\", để bấm vào đấy là bật terminal start app lên để dùng, cho non-tech user dùng"

**Decisions — combined sheet**
- Added `buildCombinedSheet` as sheet #1. Workbook order now: **Tổng hợp → Hóa đơn → Chi tiết hàng hóa**.
- Flat denormalized layout: invoice fields repeated on every line-item row (best for pivot tables / Excel filter). Invoice with 0 line items → 1 row with blank item columns.
- 23 columns total. Naming disambiguated with suffixes to avoid collision: `Tiền hàng (HĐ)` vs `Thành tiền` (line), `Thuế suất (HĐ)` vs `Thuế suất (dòng)`, etc.
- Freeze first 2 columns (`xSplit: 2`) + header row so ID + số hóa đơn luôn nhìn thấy khi scroll ngang. Other sheets only freeze header row.
- Reused same numFmt constants (CURRENCY/PERCENT/DATE/NUMBER) + `styleHeaderRow` helper — no style drift between sheets.
- Existing xlsx test still passes (only asserts ZIP signature — sheet count not asserted).

**Windows launcher — `C:\htdocs\viettel-ocr\Start-InvoiceTool.bat`**
- Placed at repo root (OUTSIDE `invoice-tool/`) per user spec: double-click target location.
- Steps: `chcp 65001` → check Node → auto-run `npm run setup` if `config.env` missing → auto-run `npm install` if `node_modules` missing → schedule `start http://localhost:3001` after 20s via backgrounded `timeout /t 20 /nobreak` → blocking `npm start`.
- Used `cd /d "%~dp0invoice-tool"` so double-click works regardless of current dir.
- ASCII-only error text + diacritic-free filename (`Start-InvoiceTool.bat`) — avoids cmd.exe encoding issues on Vietnamese Windows even with chcp 65001 (batch files are parsed before chcp takes effect for the filename).
- UI text in file body uses no Vietnamese diacritics either (some cmd fonts still garble UTF-8 despite chcp) — trades prettiness for reliability on non-tech machines.
- Background browser-open trick: `start "" /b cmd /c "timeout /t 20 /nobreak >nul && start http://localhost:3001"` — runs detached so blocking `npm start` after it doesn't prevent browser launch.

**Gotchas for future Windows scripts**
- `chcp 65001` doesn't retroactively fix already-printed bytes in the same .bat — safest is ASCII-only in .bat files.
- `npm start` in this repo must run from `invoice-tool/` (workspace root), not repo root — there's no package.json at `C:\htdocs\viettel-ocr\`.
- `config.env` is in `invoice-tool/`, not repo root. `start.js:validateConfig()` exits 1 if missing.
- Frontend (Next.js dev) takes 10–20s cold compile — 20s browser delay is a reasonable floor. Going below 10s opens browser to a spinning loader.

## Key Files

| Resource | Path |
|---|---|
| Business Spec | `tasks/01-business-spec.md` |
| Database Design | `tasks/04-database-design.md` |
| Low-Level Design | `tasks/06-low-level-design.md` |
| **Master Plan (Phase 2 — ACTIVE)** | `tasks/09-phase2-master-plan.md` |
| Master Plan (Phase 1 — historical) | `tasks/08-master-plan.md` |
| Session Handoff | `.context/session-handoff.md` |
| Config | `config.env` |
| API Client | `packages/frontend/src/lib/api-client.ts` |
| Vietnamese Text | `packages/frontend/src/lib/constants.ts` |
| App Layout | `packages/frontend/src/components/layout/AppShell.tsx` |
