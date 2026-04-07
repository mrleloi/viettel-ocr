# Master Plan — Implementation Strategy

**Version**: 1.0  
**Date**: 2026-04-07  
**Approach**: Clean Architecture + DDD + BDD (Red-Green-Refactor) + Spec-Driven + Agentic Workflow  

---

## 1. Implementation Philosophy

### Core Principles

1. **Domain-First**: Domain layer is the heart. All business logic lives here. No framework dependencies.
2. **Test-First (BDD/Red-Green-Refactor)**: Always write tests before implementation. Tests ARE the spec.
3. **Spec-Driven**: OpenAPI spec is the contract. Generate, don't handwrite.
4. **Bounded Contexts**: Clear module boundaries. Each context owns its data and logic.
5. **Agent-Implementable**: Every task must be self-contained, testable, and verifiable by an AI agent.

---

## 2. Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BOUNDED CONTEXTS                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   INTAKE      │  │  PROCESSING  │  │  SCHEMA MANAGEMENT       │  │
│  │               │  │              │  │                           │  │
│  │ - Upload      │  │ - Pipeline   │  │ - Schema CRUD            │  │
│  │ - Batch       │  │ - OCR/AI     │  │ - Fingerprint rules      │  │
│  │ - Preprocess  │  │ - Classify   │  │ - Field definitions      │  │
│  │ - Dedup       │  │ - Extract    │  │ - Prompt templates       │  │
│  │               │  │ - Validate   │  │ - Behavior config        │  │
│  │               │  │ - Score      │  │ - Schema testing         │  │
│  │               │  │ - Route      │  │                           │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                  │                      │                   │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────┴───────────────┐  │
│  │   REVIEW      │  │  CATALOG     │  │  OUTPUT                  │  │
│  │               │  │              │  │                           │  │
│  │ - Queue       │  │ - Products   │  │ - Export (CSV/JSON/XLSX) │  │
│  │ - Approve     │  │ - Sync       │  │ - Notifications          │  │
│  │ - Reject      │  │ - Conflicts  │  │ - Audit log              │  │
│  │ - Edit        │  │ - Mappings   │  │ - Diagnostics            │  │
│  │ - Audit trail │  │ - Fuzzy      │  │ - SSE events             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Context Interactions (Events/Commands)

```
INTAKE → emits → InvoiceCreated, BatchReady
PROCESSING → consumes → BatchReady
           → uses → SchemaManagement (read fingerprint, fields, prompt)
           → uses → Catalog (read mappings, products)
           → emits → InvoiceProcessed, InvoiceNeedsReview
REVIEW → consumes → InvoiceNeedsReview
       → emits → InvoiceApproved, InvoiceRejected, MappingLearned
CATALOG → consumes → MappingLearned
        → emits → SyncConflictDetected, ProductChanged
OUTPUT → consumes → InvoiceProcessed, InvoiceApproved
       → emits → ExportCompleted, NotificationCreated
```

---

## 3. Business Spec → Technical Spec Transformation

### Transformation Pipeline

```
01-business-spec.md (Feature F01-F13)
    ↓
For each feature:
    ↓
├── Identify bounded context
├── Extract domain entities, value objects, aggregates
├── Write BDD scenarios (Given-When-Then)
├── Define use cases (application layer)
├── Define repository interfaces (domain layer)
├── Define DTOs and API endpoints (interface layer)
├── Write unit tests (domain) — RED
├── Implement domain logic — GREEN
├── Write integration tests (use cases) — RED
├── Implement use cases — GREEN
├── Write API tests (controllers) — RED
├── Implement controllers — GREEN
├── REFACTOR
└── Generate/update OpenAPI spec
```

### Example: F01 (Upload) Transformation

**Business Spec** (from 01-business-spec.md):
> "Operator upload hóa đơn PDF. Hệ thống chấp nhận single, multiple, ZIP."

**Technical Specs Generated**:

1. `specs/intake/batch.entity.spec.ts` — Batch entity behavior
2. `specs/intake/upload-batch.use-case.spec.ts` — Upload use case
3. `specs/intake/file-preprocessor.spec.ts` — ZIP extraction, validation
4. `specs/intake/dedup-checker.spec.ts` — Duplicate detection
5. `specs/intake/batch.controller.spec.ts` — HTTP endpoint

**BDD Scenario Example**:
```gherkin
Feature: Batch Upload

  Scenario: Upload single PDF with known NCC
    Given a schema "Digiworld" exists with status "active"
    And the schema has MST fingerprint rule "0302861742"
    When operator uploads 1 PDF file with hint schema "Digiworld"
    Then a batch is created with status "processing"
    And 1 invoice record is created with status "pending"
    And the invoice classification_method is "frontend_hint"

  Scenario: Upload ZIP with mixed NCCs
    Given schemas "Digiworld" and "Samsung" exist
    When operator uploads a ZIP containing 3 PDFs with mode "mixed"
    Then a batch is created with total_files = 3
    And 3 invoice records are created with status "pending"
    And each invoice is queued for fingerprint classification

  Scenario: Upload duplicate file
    Given an invoice with file_hash "abc123" already exists
    When operator uploads a PDF with file_hash "abc123"
    Then the new invoice status is "duplicate"
    And a notification is created with category "duplicate_detected"
    And the invoice links to the original via duplicate_of

  Scenario: Reject non-PDF file
    When operator uploads a file "data.xlsx"
    Then the file is rejected with reason "Not a PDF file"
    And no invoice record is created
```

---

## 4. Implementation Phases (Ordered by Dependency)

### Phase 1: Foundation & Domain Core

```
Step 1.1: Project scaffolding
  - Monorepo setup (npm workspaces)
  - NestJS backend skeleton
  - Next.js frontend skeleton
  - Shared types package
  - Database setup (Drizzle + SQLite)
  - Config loader

Step 1.2: Domain entities & value objects (ALL contexts)
  - Invoice entity + value objects (InvoiceNumber, TaxId, Money, Confidence)
  - Schema entity + value objects
  - Batch entity
  - Product entity
  - Mapping entity
  - Tests: pure unit tests, no DB

Step 1.3: Repository interfaces (ALL contexts)
  - Define interfaces in domain layer
  - NO implementation yet

Step 1.4: Domain services (ALL contexts)
  - FingerprintService
  - ValidatorService
  - ConfidenceCalculator
  - FuzzyMatcher
  - PromptBuilder
  - Tests: unit tests with mocked repositories
```

### Phase 2: Infrastructure & Application

```
Step 2.1: Database repositories (concrete implementations)
  - Implement all repository interfaces with Drizzle + SQLite
  - Tests: integration tests with real SQLite (in-memory)

Step 2.2: External integrations
  - GeminiClient (AI API)
  - ViettelProductClient (external API)
  - MockProductServer
  - LocalFileStorage
  - Tests: integration tests with mocked HTTP

Step 2.3: Job Queue
  - SQLite-backed queue implementation
  - Tests: concurrency tests, restart recovery

Step 2.4: Application use cases
  - All use cases listed in low-level design
  - Tests: integration tests (use cases + real repos + mocked external)
```

### Phase 3: Interface Layer (API)

```
Step 3.1: Controllers + DTOs
  - All REST endpoints
  - SSE event stream
  - OpenAPI spec generation
  - Tests: API integration tests (supertest)

Step 3.2: Generate OpenAPI client
  - Run codegen → packages/shared/src/api/generated/
```

### Phase 4: Frontend

```
Step 4.1: Layout & navigation
  - Sidebar, header, notification bell
  - Route structure

Step 4.2: Dashboard page
Step 4.3: Upload page
Step 4.4: Review queue + detail pages
Step 4.5: Schema management pages (list, wizard, detail)
Step 4.6: Mapping management page
Step 4.7: Product management page
Step 4.8: Export page
Step 4.9: Diagnostics page
Step 4.10: SSE integration (real-time updates)
```

### Phase 5: Integration & Polish

```
Step 5.1: End-to-end testing (full flow)
Step 5.2: Setup script (npm run setup)
Step 5.3: Start script (npm start)
Step 5.4: Config validation
Step 5.5: Error handling polish
Step 5.6: Performance testing (100-file batch)
```

---

## 5. Test Strategy (BDD / Red-Green-Refactor)

### Test Pyramid

```
         ╱╲
        ╱  ╲         E2E Tests (5-10)
       ╱    ╲        Full flow: upload → process → export
      ╱──────╲
     ╱        ╲      API Integration Tests (30-50)
    ╱          ╲     Controller + use case + DB
   ╱────────────╲
  ╱              ╲   Domain Unit Tests (100-200)
 ╱                ╲  Pure logic, mocked dependencies
╱──────────────────╲
```

### Test Naming Convention

```
describe('InvoiceValidator', () => {
  describe('validate', () => {
    it('should pass when all required fields present and valid');
    it('should fail when invoice_number is missing');
    it('should fail when total does not match subtotal + vat');
    it('should warn when invoice_date is older than 6 months');
    it('should accept 0 VND total for warranty invoices');
  });
});
```

### Red-Green-Refactor Workflow

```
For each feature/story:
  1. WRITE test file (RED phase)
     - Write all test cases based on BDD scenarios
     - Tests MUST fail (implementation doesn't exist)
     - Commit: "test: add specs for [FeatureName]"
  
  2. IMPLEMENT code (GREEN phase)
     - Write minimum code to pass ALL tests
     - No premature optimization
     - Commit: "feat: implement [FeatureName]"
  
  3. REFACTOR
     - Clean up code while keeping tests green
     - Extract helpers, reduce duplication
     - Commit: "refactor: clean up [FeatureName]"
```

---

## 6. Agentic Workflow — Agent Configuration

> **Full agent configs are in dedicated files.** This section is an index.
> Do NOT duplicate config here — the files below are the source of truth.

### 6.1 Agent Identity & Config Files

| File | Agent | Purpose |
|------|-------|---------|
| `CLAUDE.md` | Claude Code (Architect) | Identity, session protocol, quality gates, hard rules |
| `.gemini/AGENTS.md` | Antigravity (Developer) | Identity, skill router, hard rules, session dispatch, architecture patterns |
| `ARCHITECTURE.md` | Both | Quick architecture reference |

### 6.2 Skills (12 files)

| Skill | File | When to read |
|-------|------|-------------|
| Session Handoff | `.agents/skills/session-handoff/skill.md` | Every session start/end |
| Quality Self-Check | `.agents/skills/quality-self-check/skill.md` | Before any completion claim |
| Domain Modeling | `.agents/skills/domain-modeling/skill.md` | Implementing entities/VOs/domain services |
| BDD Test Writing | `.agents/skills/bdd-test-writing/skill.md` | RED phase of any feature |
| Repository Implementation | `.agents/skills/repository-implementation/skill.md` | Implementing Drizzle+SQLite repos |
| Use Case Implementation | `.agents/skills/use-case-implementation/skill.md` | Implementing application use cases |
| API Controller | `.agents/skills/api-controller/skill.md` | Implementing NestJS controllers |
| Pipeline Stage | `.agents/skills/pipeline-stage/skill.md` | Implementing processing pipeline stages |
| Gemini Integration | `.agents/skills/gemini-integration/skill.md` | OCR/AI API integration |
| Frontend Component | `.agents/skills/frontend-component/skill.md` | Next.js pages and components |
| Batch Implementation | `.agents/skills/batch-implementation/skill.md` | Implementing 3+ items in one session |
| Project Scaffold | `.agents/skills/project-scaffold/skill.md` | Session 1 only |

### 6.3 Workflows (7 files)

| Workflow | File | Trigger |
|----------|------|---------|
| Implement Domain | `.agents/workflows/implement-domain.md` | Entity/VO implementation |
| Implement Use Case | `.agents/workflows/implement-use-case.md` | Use case implementation |
| Implement API | `.agents/workflows/implement-api.md` | REST endpoint implementation |
| Implement Page | `.agents/workflows/implement-page.md` | Frontend page implementation |
| Implement Pipeline Stage | `.agents/workflows/implement-pipeline-stage.md` | Processing stage implementation |
| Quality Gate Pipeline | `.agents/workflows/quality-gate-pipeline.md` | Before commit or session end |
| Session Handoff | `.agents/workflows/session-handoff.md` | Every session lifecycle |

### 6.4 Commands (6 files)

| Command | File | Purpose |
|---------|------|---------|
| /session-start | `.claude/commands/session-start.md` | Begin work session |
| /session-end | `.claude/commands/session-end.md` | End work session |
| /spec | `.claude/commands/spec.md` | Write BDD test specs |
| /action-guide | `.claude/commands/action-guide.md` | Generate implementation guide |
| /verify | `.claude/commands/verify.md` | Run full quality gate |
| /drift-check | `.claude/commands/drift-check.md` | Detect architecture violations |

### 6.5 Rules (auto-loaded, 3 files)

| Rule | File | Enforces |
|------|------|----------|
| Architecture | `.claude/rules/architecture.md` | Layer boundaries, patterns, DI |
| Code Style | `.claude/rules/code-style.md` | Naming, formatting, commits |
| Testing | `.claude/rules/testing.md` | Red-Green-Refactor, coverage |

### 6.6 Context (persistent state, 3 files)

| File | Purpose | Updated |
|------|---------|---------|
| `.context/session-handoff.md` | Cross-session state transfer | Every session start/end |
| `.context/agent-notes.md` | Persistent learned rules + progress | Every session end |
| `.context/drift-signals.md` | Architecture violation tracking | After each /drift-check |

### 6.7 Scripts

| Script | Purpose |
|--------|---------|
| `.agents/scripts/drift-check.sh` | Automated architecture violation detection |

### 6.8 Agent Collaboration Model



Key constraints:
- Developer NEVER implements without reading action guide first
- Developer NEVER claims done without fresh `tsc --noEmit && jest --bail` output
- Architect NEVER creates action guide without reading business spec first
- Both agents update `.context/session-handoff.md` and `.context/agent-notes.md` every session
- Session IDs come from master plan ONLY — agents never invent new sessions

## 7. Session Plan (Suggested Assignment)

| Session | Phase Step | Scope | Est. Files |
|---------|-----------|-------|------------|
| 1 | 1.1 | Project scaffolding, monorepo, configs | 15-20 |
| 2 | 1.2 | Domain entities & value objects (all contexts) | 15-20 |
| 3 | 1.3 + 1.4a | Repository interfaces + FingerprintService + ValidatorService | 15-20 |
| 4 | 1.4b | ConfidenceCalculator + FuzzyMatcher + PromptBuilder | 10-15 |
| 5 | 2.1 | Database schema (Drizzle) + repository implementations | 15-20 |
| 6 | 2.2 | GeminiClient + ViettelClient + MockServer + FileStorage | 10-15 |
| 7 | 2.3 + 2.4a | Job Queue + Upload/Processing use cases | 15-20 |
| 8 | 2.4b | Review/Schema/Mapping/Product/Export use cases | 15-20 |
| 9 | 3.1 | All REST controllers + DTOs + OpenAPI spec | 15-20 |
| 10 | 3.2 + 4.1 | OpenAPI client gen + Frontend layout/nav | 10-15 |
| 11 | 4.2 + 4.3 | Dashboard + Upload pages | 10-15 |
| 12 | 4.4 | Review queue + detail page (PDF viewer) | 10-15 |
| 13 | 4.5 + 4.6 | Schema wizard + Mapping page | 10-15 |
| 14 | 4.7 + 4.8 + 4.9 | Products + Exports + Diagnostics pages | 10-15 |
| 15 | 4.10 + 5.x | SSE integration + setup/start scripts + E2E | 10-15 |

**Total estimate**: ~15 sessions, ~200 files, ~500+ tests

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Gemini API prompt doesn't extract well for certain invoice formats | Include 3+ diverse sample invoices in test suite. Prompt iteration in schema testing UI |
| SQLite write bottleneck with 5 concurrent users | WAL mode + serialize writes through queue. Monitor in diagnostics |
| Monorepo build complexity | npm workspaces (simplest). No Turborepo/Nx unless needed |
| Agent session loses context | Handoff documents are comprehensive. Design docs are the source of truth |
| OCR quality varies | Validation layer catches bad extractions. Confidence scoring routes to human review |
| Scope creep during implementation | Each session has strict scope. Defer anything not in current phase step |
