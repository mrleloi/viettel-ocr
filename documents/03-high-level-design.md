# High-Level Design & Architecture Decision Record

**Version**: 1.0  
**Date**: 2026-04-07  

---

## 1. System Context Diagram

```
┌─────────────┐     ┌──────────────────────────────────────────────┐     ┌─────────────────┐
│   Operator   │────▶│           Invoice Processing Tool            │────▶│  Gemini Flash   │
│ Configurator │◀────│           (localhost:3000)                    │◀────│  API (Google)   │
│  Tech Support│     │                                              │     └─────────────────┘
└─────────────┘     │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │     ┌─────────────────┐
                     │  │ Next.js  │  │ NestJS   │  │ SQLite   │  │────▶│ Viettel Product  │
                     │  │ Frontend │◀▶│ Backend  │◀▶│ Database │  │◀────│ API (Mock/Real) │
                     │  └──────────┘  └──────────┘  └──────────┘  │     └─────────────────┘
                     │                     ▲                       │
                     │                     │                       │
                     │              ┌──────────┐                  │
                     │              │ File     │                  │
                     │              │ Storage  │                  │
                     │              │ (local)  │                  │
                     │              └──────────┘                  │
                     └──────────────────────────────────────────────┘
```

## 2. Architecture Decision Records (ADR)

### ADR-001: Monorepo with Next.js + NestJS

**Context**: Cần stack đơn giản, 1 command start, non-technical users cài đặt được.

**Decision**: Monorepo (npm workspaces) chứa:
- `packages/frontend` — Next.js (React)
- `packages/backend` — NestJS
- `packages/shared` — Shared types, OpenAPI generated client
- `packages/mock-server` — Mock Viettel Product API

**Consequences**:
- ✅ 1 repo, 1 `npm install`, 1 `npm start` chạy tất cả
- ✅ Shared types đảm bảo type-safe giữa FE/BE
- ✅ OpenAPI generate client → contract-first development
- ⚠️ Monorepo complexity (npm workspaces)

### ADR-002: SQLite as Database

**Context**: Không muốn user phải cài database server.

**Decision**: SQLite với better-sqlite3 (sync driver) hoặc drizzle-orm.

**Consequences**:
- ✅ Zero config, single file
- ✅ WAL mode → concurrent reads OK
- ✅ Backup = copy 1 file
- ⚠️ Single writer — concurrent writes serialized (OK for 5 users)
- ⚠️ No full-text search natively (FTS5 extension available)

### ADR-003: File Storage = Local Filesystem

**Context**: Không cần cloud storage cho MVP localhost.

**Decision**: Structured folder layout:
```
data/
  uploads/{batch_id}/{original_filename}.pdf
  exports/{export_id}/{filename}.csv
  database.sqlite
```

**Consequences**:
- ✅ Simple, no dependencies
- ✅ Backup = copy folder
- ⚠️ Disk management is user's responsibility
- ⚠️ No CDN / streaming (OK for localhost)

### ADR-004: Gemini Flash as Primary (and Only) AI Model

**Context**: Cần OCR + extraction + classification. Budget constraint.

**Decision**: Gemini 2.0 Flash cho tất cả AI tasks:
- OCR + field extraction: 1 API call per invoice (known schema)
- OCR + classification + extraction: 1 API call per invoice (unknown schema)
- No separate LLM call for classification

**Consequences**:
- ✅ Single API key, single provider
- ✅ Cost optimized — 1 call does everything
- ✅ Gemini Flash natively handles PDF/image input
- ⚠️ Single point of failure (no fallback model)
- ⚠️ Dependent on Google API availability

### ADR-005: In-Process Job Queue (No Redis)

**Context**: Batch processing 1000 files cần queue. Redis quá phức tạp cho MVP.

**Decision**: In-process queue implementation:
- NestJS Bull-less queue: sử dụng custom queue service với SQLite-backed persistence
- Job states persisted in SQLite table `processing_jobs`
- On startup, resume unfinished jobs

**Queue design**:
```
Job States: pending → processing → completed | failed | cancelled
Concurrency: configurable (default 5 parallel API calls)
Retry: 3 attempts with exponential backoff
Priority: FIFO within batch, batches ordered by submission time
```

**Consequences**:
- ✅ No external dependency
- ✅ Queue survives restart (SQLite persisted)
- ✅ Simple implementation
- ⚠️ No distributed processing (OK for single machine)

### ADR-006: OpenAPI Contract-First Development

**Context**: Frontend (Next.js) và Backend (NestJS) cần giao tiếp rõ ràng.

**Decision**:
1. NestJS define API with Swagger decorators → auto-generate OpenAPI spec
2. Frontend consume via generated TypeScript client (openapi-typescript-codegen)
3. Shared types package for domain models

**Consequences**:
- ✅ Type-safe API calls
- ✅ Auto-generated client — no manual HTTP code
- ✅ API documentation for free
- ⚠️ Codegen step in build pipeline

### ADR-007: Server-Sent Events (SSE) for Real-time Updates

**Context**: Operator cần thấy progress batch processing real-time.

**Decision**: SSE (Server-Sent Events) thay vì WebSocket.

**Consequences**:
- ✅ Simpler than WebSocket (unidirectional)
- ✅ Native browser support, auto-reconnect
- ✅ NestJS built-in SSE support
- ⚠️ One-way only (server → client). OK for progress updates

---

## 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│                                                                   │
│  Pages:                          Components:                      │
│  ┌─────────────┐                ┌───────────────────┐            │
│  │ /dashboard   │                │ FileUploader       │            │
│  │ /upload      │                │ BatchProgress      │            │
│  │ /review      │                │ InvoiceViewer      │            │
│  │ /review/[id] │                │ FieldEditor        │            │
│  │ /schemas     │                │ SchemaWizard       │            │
│  │ /schemas/[id]│                │ MappingTable       │            │
│  │ /mappings    │                │ ProductSyncPanel   │            │
│  │ /products    │                │ NotificationBell   │            │
│  │ /exports     │                │ DiagnosticPanel    │            │
│  │ /diagnostics │                │ ConfidenceBadge    │            │
│  └─────────────┘                └───────────────────┘            │
│                                                                   │
│  State: React Query (server state) + Zustand (UI state)          │
│  API Client: auto-generated from OpenAPI spec                     │
└───────────────────────────────────────────────────────────────────┘
                              │ HTTP / SSE
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                         BACKEND (NestJS)                          │
│                                                                   │
│  Modules:                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ UploadModule    │  │ ProcessingModule│  │ SchemaModule       │  │
│  │ - FileController│  │ - QueueService  │  │ - SchemaController │  │
│  │ - UploadService │  │ - OcrService    │  │ - SchemaService    │  │
│  │ - BatchService  │  │ - ClassifyServ  │  │ - FingerprintServ  │  │
│  │                 │  │ - ExtractService│  │                    │  │
│  │                 │  │ - ValidateServ  │  │                    │  │
│  └────────────────┘  └────────────────┘  └───────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ MappingModule   │  │ ProductModule   │  │ ExportModule       │  │
│  │ - MappingCtrl   │  │ - ProductCtrl   │  │ - ExportController │  │
│  │ - MappingService│  │ - SyncService   │  │ - ExportService    │  │
│  │ - FuzzyMatcher  │  │ - ConflictServ  │  │ - CsvGenerator     │  │
│  │                 │  │ - MockApiServ   │  │ - ExcelGenerator   │  │
│  └────────────────┘  └────────────────┘  └───────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ ReviewModule    │  │ NotifyModule    │  │ DiagnosticModule   │  │
│  │ - ReviewCtrl    │  │ - NotifyService │  │ - HealthController │  │
│  │ - ReviewService │  │ - SSE endpoint  │  │ - LogService       │  │
│  │ - AuditService  │  │                 │  │ - MetricsService   │  │
│  └────────────────┘  └────────────────┘  └───────────────────┘  │
│                                                                   │
│  Infrastructure:                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ DatabaseModule   │  │ ConfigModule    │  │ GeminiModule       │  │
│  │ (Drizzle+SQLite)│  │ (config.env)    │  │ (API client)       │  │
│  └────────────────┘  └────────────────┘  └───────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 4. API Design (Key Endpoints)

### Upload & Processing
```
POST   /api/batches                    Create batch + upload files
GET    /api/batches                    List batches (paginated, filtered)
GET    /api/batches/:id                Get batch detail + summary
POST   /api/batches/:id/cancel         Cancel unprocessed files
GET    /api/batches/:id/progress       SSE endpoint for real-time progress

GET    /api/invoices                   List invoices (paginated, filtered)
GET    /api/invoices/:id               Get invoice detail (extracted data + trace)
PUT    /api/invoices/:id               Update invoice fields (operator edit)
POST   /api/invoices/:id/approve       Approve invoice
POST   /api/invoices/:id/reject        Reject invoice
POST   /api/invoices/:id/reprocess     Re-run OCR + extraction
GET    /api/invoices/:id/pdf           Serve original PDF file
GET    /api/invoices/:id/trace         Get full processing trace
```

### Schema Management
```
GET    /api/schemas                    List all schemas
POST   /api/schemas                    Create schema (wizard)
GET    /api/schemas/:id                Get schema detail
PUT    /api/schemas/:id                Update schema
PATCH  /api/schemas/:id/status         Change status (active/testing/disabled)
POST   /api/schemas/:id/test           Test schema against sample files
GET    /api/schemas/:id/stats          Get schema performance stats
```

### Mapping & Products
```
GET    /api/mappings                   List mappings (filtered by NCC)
POST   /api/mappings                   Create mapping
PUT    /api/mappings/:id               Update mapping
DELETE /api/mappings/:id               Disable mapping
POST   /api/mappings/bulk-import       Import from Excel

GET    /api/products                   List Viettel products
POST   /api/products/sync              Trigger manual sync
GET    /api/products/conflicts          List unresolved conflicts
POST   /api/products/conflicts/:id/resolve  Resolve conflict
```

### Export
```
POST   /api/exports                    Create export job
GET    /api/exports                    List exports
GET    /api/exports/:id/download       Download export file
```

### System
```
GET    /api/health                     Health check (API status, DB, disk)
GET    /api/diagnostics                System diagnostics
GET    /api/notifications              List notifications (for bell icon)
PATCH  /api/notifications/:id/read     Mark notification as read
GET    /api/config                     Get non-sensitive config
GET    /api/events                     SSE stream for real-time notifications
```

---

## 5. Processing Pipeline (Detailed)

```
           ┌──────────────────────────────────────────────────────────────┐
           │                    PROCESSING PIPELINE                        │
           │                                                               │
 Upload    │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │
 ─────────▶│  │PREPROCESS│───▶│  CLASSIFY │───▶│ EXTRACT  │───▶│VALIDATE│ │
           │  │          │    │          │    │          │    │        │ │
           │  │- Unzip   │    │- Frontend│    │- Gemini  │    │- Rules │ │
           │  │- Validate│    │  hint    │    │  Flash   │    │- Cross │ │
           │  │- Dedup   │    │- Finger- │    │  API     │    │  check │ │
           │  │  check   │    │  print   │    │- Parse   │    │- Score │ │
           │  │- Hash    │    │- Cache   │    │  JSON    │    │        │ │
           │  │- Queue   │    │  lookup  │    │- Cache   │    │        │ │
           │  └──────────┘    └──────────┘    └──────────┘    └────────┘ │
           │        │              │                │              │       │
           │        ▼              ▼                ▼              ▼       │
           │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │
           │  │  MAP &   │───▶│  ROUTE   │───▶│  ACTION  │───▶│  LOG   │ │
           │  │  MATCH   │    │          │    │          │    │        │ │
           │  │          │    │- Score   │    │- Export  │    │- Trace │ │
           │  │- Product │    │  calc    │    │- Show    │    │- Audit │ │
           │  │  mapping │    │- High→   │    │- Queue   │    │- Stats │ │
           │  │- PO match│    │  auto    │    │  review  │    │        │ │
           │  │  (basic) │    │- Med→    │    │- Notify  │    │        │ │
           │  │          │    │  review  │    │          │    │        │ │
           │  │          │    │- Low→    │    │          │    │        │ │
           │  │          │    │  config  │    │          │    │        │ │
           │  └──────────┘    └──────────┘    └──────────┘    └────────┘ │
           └──────────────────────────────────────────────────────────────┘
```
