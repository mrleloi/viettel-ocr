# Invoice Processing Tool — Architecture

> Quick reference for all agents. For full details see `tasks/03-high-level-design.md`.
> Phase 2 updates: Notification context, reprocess flow, PDF viewer.

## Stack

```
Frontend:  Next.js 14 + React 19 + Tailwind + shadcn/ui
           Phase 2: + react-pdf (session 21, PDF viewer)
           Phase 2: + Zustand (notification store, session 18)
Backend:   NestJS 10 + Drizzle ORM + SQLite (WAL mode)
AI/OCR:    Gemini 2.0 Flash API
Shared:    TypeScript types + OpenAPI generated client
Mock:      Express server for Viettel Product API
OS/Shell:  Windows 11 + PowerShell (bash syntax NOT supported)
```

## Monorepo

```
invoice-tool/
├── packages/
│   ├── shared/         # Types, generated API client, constants
│   ├── backend/        # NestJS — domain, application, infrastructure, interface
│   ├── frontend/       # Next.js — pages, components, hooks, stores
│   └── mock-server/    # Viettel Product mock API
├── data/               # Runtime: SQLite DB, uploads, exports (gitignored)
├── config.env          # User config (API keys, ports)
├── CLAUDE.md           # Architect agent config
├── architecture.md     # This file
└── tasks/              # All specs, designs, plans, action guides
```

## Clean Architecture Layers (Backend)

```
┌──────────────────────────────────────────┐
│  Interface Layer (controllers, DTOs, SSE) │ ← HTTP in/out
├──────────────────────────────────────────┤
│  Application Layer (use cases)            │ ← Orchestration
├──────────────────────────────────────────┤
│  Domain Layer (entities, services, repos) │ ← Business logic (PURE)
├──────────────────────────────────────────┤
│  Infrastructure (DB, AI, queue, storage)  │ ← External concerns
└──────────────────────────────────────────┘

Dependency rule: outer layers depend on inner, NEVER reverse.
Domain has ZERO imports from NestJS or infrastructure.
```

## Bounded Contexts

| Context | Responsibility | Key Entities |
|---------|---------------|-------------|
| **INTAKE** | Upload, batch, preprocessing, dedup, duplicate policy | Batch, Invoice (creation) |
| **PROCESSING** | OCR, classify, extract, validate, score, route, reprocess | Pipeline stages, ProcessingTrace |
| **SCHEMA** | Invoice type config, fingerprints, prompts, behavior, sample preview | Schema, FingerprintRule, FieldDefinition |
| **CATALOG** | Viettel products, sync, conflict resolution, mappings | ViettelProduct, ProductMapping, SyncConflict |
| **REVIEW** | Human review queue, approve/reject, edit, audit, PDF viewer | Review actions on Invoice |
| **OUTPUT** | Export (filtered, batch), diagnostics | ExportJob |
| **NOTIFICATION** | Notification lifecycle, emit-on-event, mark-read, SSE push | Notification, NotificationCategory |

## Data Flow (Primary)

```
Upload PDF → Preprocess → Dedup Check → Classify (fingerprint/AI)
  → OCR+Extract (Gemini Flash) → Validate (rules) → Map Products (fuzzy)
  → Score Confidence → Route (auto/review/configurator) → Action (export/show)

Notification flow (Phase 2):
  Use Case emits event → Event Bus → NotificationUseCase → Notification repo
  → SSE push → Frontend bell dropdown (real-time)

Reprocess flow (Phase 2):
  Review detail → "Reprocess" action → ReprocessUseCase → reset Invoice
  → re-enqueue → full pipeline re-run → updated results
```

## Key Patterns

- **Entities**: Validate on construction, expose via getters, mutate via methods
- **Value Objects**: Immutable, self-validating (TaxId, Money, Confidence)
- **Repositories**: Interface in domain/, implementation in infrastructure/
- **Use Cases**: One `execute()` method, orchestrate domain + repos
- **Controllers**: Thin, delegate to use cases, Swagger decorators
- **Queue**: SQLite-backed, in-process, configurable concurrency
- **SSE**: Server-Sent Events for real-time batch progress + notifications
- **OpenAPI**: Contract-first, generated TypeScript client for frontend
- **Notifications**: Event-bus emit pattern. NEVER create notifications as side effects in use cases.
- **PDF Viewer**: `react-pdf` with `next/dynamic` import (no SSR) for review detail page

## External APIs

| Service | Purpose | Auth |
|---------|---------|------|
| Gemini 2.0 Flash | OCR + extraction + classification | API key in config.env |
| Viettel Product API | Product master data sync | Configurable URL (mock default at localhost:3002) |

## Database

SQLite 3 with WAL mode. 17+ tables. See `tasks/04-database-design.md`.
Backup = copy `data/database.sqlite`.

**Phase 2 migration note**: `CREATE TABLE IF NOT EXISTS` does NOT add columns to existing tables.
When adding columns (e.g. `outputKey` on `field_definitions`), use `ALTER TABLE ADD COLUMN` or `db-reset`.

## Deployment

```bash
# Prerequisites: Node.js 20 LTS
npm run setup    # Install deps, migrate DB, build
# Edit config.env with API keys
npm start        # Starts backend + frontend + mock server
# Open http://localhost:3000
```
