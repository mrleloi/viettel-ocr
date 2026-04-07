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

### 6.1 Agent Identity & Constitution

```yaml
agent_identity:
  name: "Invoice Tool Builder"
  role: "Full-stack developer implementing Invoice Processing Tool MVP"
  expertise:
    - TypeScript / Node.js
    - NestJS (backend)
    - Next.js / React (frontend)
    - SQLite / Drizzle ORM
    - Clean Architecture / DDD
    - BDD / Test-Driven Development
    - OpenAPI / Swagger

constitution:
  # Core rules the agent MUST follow
  rules:
    - "NEVER implement code before writing tests. Red phase ALWAYS comes first."
    - "NEVER put business logic in controllers or infrastructure layer."
    - "NEVER use any, always use explicit types from shared package."
    - "NEVER skip error handling. Every async operation has try/catch."
    - "NEVER modify existing passing tests without explicit instruction."
    - "ALWAYS read the relevant spec file before implementing."
    - "ALWAYS run tests after implementation to verify green."
    - "ALWAYS commit after each Red-Green-Refactor cycle."
    - "ALWAYS follow the project structure defined in 06-low-level-design.md."
    - "ALWAYS use dependency injection (NestJS providers)."
    - "Domain layer has ZERO imports from infrastructure or framework."
    - "Repository interfaces live in domain, implementations in infrastructure."
    - "Every public method has JSDoc with @param and @returns."
```

### 6.2 Session Structure & Handoff

```yaml
session_structure:
  # Each implementation session focuses on ONE bounded context or ONE phase step
  max_scope: "1 phase step (e.g., Step 1.2: Domain entities)"
  
  session_start:
    - Read relevant design docs (business spec, LLD, DB design)
    - Read previous session's handoff notes (if any)
    - List files to create/modify
    - State plan before coding
  
  session_end:
    - Run all tests (must pass)
    - List created/modified files
    - Write handoff notes:
      - What was completed
      - What was deferred and why
      - Known issues or TODOs
      - Next session should start with...
    - Commit with conventional commit message

handoff_document:
  template: |
    ## Session Handoff: [Session ID]
    
    ### Completed
    - [List of completed items with file paths]
    
    ### Test Results
    - Total: X tests
    - Passing: Y
    - Failing: Z (with reasons)
    
    ### Deferred
    - [Items skipped and why]
    
    ### Known Issues
    - [Any bugs or concerns]
    
    ### Next Session
    - Start by: [specific instruction]
    - Read: [specific files]
    - Context needed: [any background]
```

### 6.3 Skill Definitions

```yaml
skills:

  plan_creator:
    description: "Create implementation plan for a phase step"
    trigger: "Beginning of each session"
    steps:
      1. Read design docs relevant to current step
      2. List all files to create (with full paths)
      3. List all test files to create
      4. Define dependency order
      5. Estimate complexity per file
      6. Output plan as checklist
    output: "Ordered checklist of tasks with file paths"

  spec_writer:
    description: "Write BDD test specifications from business requirements"
    trigger: "Red phase of any feature"
    steps:
      1. Read business spec for the feature
      2. Read domain entity/service interface
      3. Identify all scenarios (happy path + edge cases + error cases)
      4. Write test file with describe/it blocks
      5. Include setup (beforeEach) with test fixtures
      6. Verify tests fail (no implementation exists)
    output: "Test file (*.spec.ts) with all scenarios"
    quality_gate: "All tests must fail with 'not implemented' or 'cannot find module' errors"

  domain_implementer:
    description: "Implement domain layer code to pass tests"
    trigger: "Green phase after specs are written"
    steps:
      1. Read failing test file
      2. Implement minimum code to pass
      3. Follow DDD patterns (entity, value object, service)
      4. No infrastructure imports
      5. Run tests, iterate until green
    output: "Implementation file(s) that pass all domain tests"
    quality_gate: "ALL tests green. No any types. No framework imports in domain."

  api_implementer:
    description: "Implement NestJS controllers and DTOs"
    trigger: "After use cases are implemented"
    steps:
      1. Read OpenAPI spec section for endpoints
      2. Write controller with Swagger decorators
      3. Write DTO classes with validation (class-validator)
      4. Wire up use cases via DI
      5. Write API integration tests
    output: "Controller, DTOs, module registration"
    quality_gate: "API tests pass. Swagger docs generate correctly."

  frontend_implementer:
    description: "Implement React/Next.js pages and components"
    trigger: "After API is stable"
    steps:
      1. Read UI spec from business-spec
      2. Use generated API client (from shared package)
      3. Build components with shadcn/ui + Tailwind
      4. Implement state with React Query + Zustand
      5. Handle loading, error, empty states
    output: "Page and component files"
    quality_gate: "Page renders without errors. API calls work. Vietnamese UI text."

  refactorer:
    description: "Clean up code while keeping tests green"
    trigger: "After green phase"
    steps:
      1. Check for code duplication
      2. Extract shared utilities
      3. Improve naming
      4. Add missing JSDoc
      5. Run tests (must stay green)
    output: "Cleaner code, same test results"
    quality_gate: "Zero test regressions"

  debugger:
    description: "Diagnose and fix failing tests or runtime errors"
    trigger: "Tests fail unexpectedly"
    steps:
      1. Read error message and stack trace
      2. Identify root cause (implementation bug vs test bug vs design gap)
      3. Fix the appropriate layer
      4. Run tests to confirm fix
      5. Document the issue in handoff notes
    output: "Fix + explanation"
    quality_gate: "Previously failing test now passes. No regressions."
```

### 6.4 Workflow Per Session

```yaml
workflow:
  name: "Implementation Session Workflow"
  steps:
    - name: "Orient"
      actions:
        - Read session assignment (which phase step)
        - Read handoff notes from previous session
        - Read relevant design docs
        - List existing files and tests
      duration: "5% of session"

    - name: "Plan"
      skill: plan_creator
      actions:
        - Create ordered task list
        - Identify dependencies
        - State assumptions
      duration: "10% of session"

    - name: "Red Phase"
      skill: spec_writer
      actions:
        - Write test files for current step
        - Verify tests fail
        - Commit: "test: add specs for [feature]"
      duration: "25% of session"

    - name: "Green Phase"
      skill: domain_implementer | api_implementer | frontend_implementer
      actions:
        - Implement to pass tests
        - Run tests after each file
        - Commit: "feat: implement [feature]"
      duration: "40% of session"

    - name: "Refactor Phase"
      skill: refactorer
      actions:
        - Clean up
        - Run full test suite
        - Commit: "refactor: clean up [feature]"
      duration: "10% of session"

    - name: "Handoff"
      actions:
        - Run full test suite
        - Write handoff document
        - List next steps
        - Commit: "docs: session handoff [N]"
      duration: "10% of session"
```

### 6.5 Quality Gates

```yaml
quality_gates:

  pre_commit:
    - All tests pass (npm test)
    - No TypeScript errors (tsc --noEmit)
    - No linting errors (eslint)
    - Conventional commit message format

  per_feature:
    - Domain tests cover: happy path + at least 2 edge cases + at least 1 error case
    - Domain layer has zero imports from @nestjs/* or infrastructure
    - Every repository interface has corresponding implementation
    - Every use case has at least 1 integration test
    - Every API endpoint has at least 1 API test

  per_phase:
    - All features in phase fully implemented and tested
    - No TODO comments without linked issue
    - Handoff document complete
    - Test coverage for domain layer ≥ 90%

  final:
    - Full E2E flow works: upload PDF → OCR → extract → review → export
    - npm run setup works on clean machine
    - npm start works
    - config.env.example has all needed keys documented
    - Dashboard loads and shows correct data
```

### 6.6 Context Management

```yaml
context_management:
  # What to keep in context for each session
  always_load:
    - "06-low-level-design.md (project structure section)"
    - "04-database-design.md (relevant tables)"
    - "Previous session handoff notes"
    - "Current test files for the feature being implemented"

  load_when_relevant:
    - "01-business-spec.md (specific feature section)"
    - "05-data-flow-design.md (specific flow)"
    - "03-high-level-design.md (API endpoints section)"

  never_needed_in_implementation:
    - "02-qa-checklist.md (planning artifact only)"
    - "07-infrastructure-design.md (deployment, not code)"

  session_memory:
    - Agent should maintain a running list of:
      - Files created this session
      - Tests written and their pass/fail status
      - Decisions made and rationale
      - Anything deferred to next session
```

### 6.7 Agent Settings (for Antigravity or similar)

```yaml
agent_settings:
  model: "claude-sonnet-4"  # or configured model
  temperature: 0            # Deterministic for code
  
  system_prompt_includes:
    - constitution (section 6.1)
    - current phase step description
    - relevant design doc sections
    - previous handoff notes
    - quality gates for current phase
  
  tool_access:
    - file_read
    - file_write
    - terminal (npm test, tsc, etc.)
    - git (commit only, no push)
  
  constraints:
    - Max files created per session: 20
    - Must run tests at least 3 times per session (after red, after green, after refactor)
    - Must produce handoff document before session ends
    - Cannot skip test writing (RED phase is mandatory)
  
  error_recovery:
    - If tests fail after green phase: debug skill activates
    - If stuck > 3 attempts on same error: document blocker in handoff, move to next task
    - If scope creep detected: defer to next session, document in handoff
```

---

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
