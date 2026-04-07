# Agent Notes (Persistent Memory)

> Invoice Processing Tool MVP. Updated: 2026-04-07 (Session 8 complete).

## Project Knowledge

- **Purpose**: Auto-process invoice PDFs via OCR + AI extraction + schema matching
- **Stack**: Next.js 14 + NestJS 10 + Drizzle + SQLite + Gemini Flash
- **Users**: ~5 (operators + configurators), localhost deployment
- **Volume**: ~1000 PDFs/day, ~10 invoice types
- **AI**: Gemini 2.0 Flash for OCR + extraction (~$3/day)
- **Architecture**: Clean Architecture + DDD, 6 bounded contexts

## Current Progress

- **Phase**: Phase 2 — Infrastructure & Application (2.4b complete, all of Phase 2 done)
- **Domain entities**: 8 implemented (Invoice, Schema, FingerprintRule, FieldDefinition, Batch, Product, SyncConflict, Mapping)
- **Value objects**: 3 implemented (TaxId, Money, Confidence)
- **Repository interfaces**: 8 created
- **Repository implementations**: 8 Drizzle + SQLite repos
- **Domain services**: 5 implemented (FingerprintService, ValidatorService, ConfidenceCalculator, FuzzyMatcher, PromptBuilder)
- **External integrations**: 3 implemented (GeminiClient, ViettelProductClient, LocalFileStorage)
- **Domain port interfaces**: 4 (IOcrService, IProductApiClient, IFileStorage, IJobQueue)
- **Infrastructure services**: SqliteJobQueue, QueueWorkerService
- **Use cases**: 10 implemented (Upload, Process, Approve, Reject, Edit, CreateSchema, UpdateSchema, SyncProducts, CreateMapping, CreateExport)
- **NestJS modules**: 7 (Config, Database, AI, ExternalApi, FileStorage, Queue, Application)
- **API endpoints**: 0 implemented
- **Frontend pages**: 0 implemented
- **Tests**: 361 total (193 domain + 85 infra + 83 application+queue, all passing)
- **Next session**: Session 9 — REST Controllers + DTOs + OpenAPI spec

## Bounded Contexts

| Context | Entities | Services | Status |
|---------|----------|----------|--------|
| INTAKE | Batch ✅, Invoice ✅ | FilePreprocessor, DedupChecker | Entities + repos + upload use case done |
| PROCESSING | (uses Invoice ✅) | Pipeline, Classifier, Extractor, **ValidatorService ✅**, **ConfidenceCalculator ✅**, Router | Process use case done |
| SCHEMA | Schema ✅, FingerprintRule ✅, FieldDefinition ✅ | **FingerprintService ✅**, **PromptBuilder ✅** | CRUD use cases done ✅ |
| CATALOG | Product ✅, SyncConflict ✅, Mapping ✅ | SyncService ✅, **FuzzyMatcher ✅** | Sync + Mapping use cases done ✅ |
| REVIEW | (uses Invoice ✅) | **Approve ✅**, **Reject ✅**, **Edit ✅** | Use cases done ✅ |
| OUTPUT | Export ✅ | **CreateExport ✅** | Export use case done ✅ |

## Learned Rules

### Architecture
- FingerprintService uses plain data interface `FingerprintRuleData` instead of entity directly — decouples service from entity internals
- ValidatorService uses `ExtractedInvoiceData` plain interface — not the Invoice entity
- Domain services are stateless: no constructor DI, receive all data as method parameters
- ConfidenceCalculator uses `ConfidenceInput` plain interface with all scoring factors
- FuzzyMatcher uses `ProductData` plain interface — not the Product entity
- PromptBuilder uses `SchemaData` and `FieldData` plain interfaces — not entity classes
- FuzzyMatcher composite scoring: 0.5 × Jaccard + 0.3 × LCS + 0.2 × brand_bonus — exact single-word match without brand = 0.8 (not 1.0)

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
- Never invent session IDs
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

## Key Files

| Resource | Path |
|---|---|
| Business Spec | `tasks/01-business-spec.md` |
| Database Design | `tasks/04-database-design.md` |
| Low-Level Design | `tasks/06-low-level-design.md` |
| Master Plan | `tasks/08-master-plan.md` |
| Session Handoff | `.context/session-handoff.md` |
| Config | `config.env` |
