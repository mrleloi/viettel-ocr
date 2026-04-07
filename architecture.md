# Invoice Processing Tool — Architecture

> Quick reference for all agents. For full details see `tasks/03-high-level-design.md`.

## Stack

```
Frontend:  Next.js 14 + React 19 + Tailwind + shadcn/ui
Backend:   NestJS 10 + Drizzle ORM + SQLite (WAL mode)
AI/OCR:    Gemini 2.0 Flash API
Shared:    TypeScript types + OpenAPI generated client
Mock:      Express server for Viettel Product API
```

## Monorepo

```
invoice-tool/
├── packages/
│   ├── shared/         # Types, generated API client, constants
│   ├── backend/        # NestJS — domain, application, infrastructure, interface
│   ├── frontend/       # Next.js — pages, components, hooks
│   └── mock-server/    # Viettel Product mock API
├── data/               # Runtime: SQLite DB, uploads, exports (gitignored)
├── config.env          # User config (API keys, ports)
├── CLAUDE.md           # Architect agent config
├── ARCHITECTURE.md     # This file
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
| **INTAKE** | Upload, batch, preprocessing, dedup | Batch, Invoice (creation) |
| **PROCESSING** | OCR, classify, extract, validate, score, route | Pipeline stages |
| **SCHEMA** | Invoice type config, fingerprints, prompts, behavior | Schema, FingerprintRule, FieldDefinition |
| **CATALOG** | Viettel products, sync, mappings | ViettelProduct, ProductMapping, SyncConflict |
| **REVIEW** | Human review queue, approve/reject, audit | Review actions on Invoice |
| **OUTPUT** | Export, notifications, diagnostics | ExportJob, Notification |

## Data Flow (Primary)

```
Upload PDF → Preprocess → Dedup Check → Classify (fingerprint/AI)
  → OCR+Extract (Gemini Flash) → Validate (rules) → Map Products (fuzzy)
  → Score Confidence → Route (auto/review/configurator) → Action (export/show)
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

## External APIs

| Service | Purpose | Auth |
|---------|---------|------|
| Gemini 2.0 Flash | OCR + extraction + classification | API key in config.env |
| Viettel Product API | Product master data sync | Configurable URL (mock default) |

## Database

SQLite 3 with WAL mode. 17 tables. See `tasks/04-database-design.md`.
Backup = copy `data/database.sqlite`.

## Deployment

```bash
# Prerequisites: Node.js 20 LTS
npm run setup    # Install deps, migrate DB, build
# Edit config.env with API keys
npm start        # Starts backend + frontend + mock server
# Open http://localhost:3000
```
