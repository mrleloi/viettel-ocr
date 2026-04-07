# Agent Notes (Persistent Memory)

> Invoice Processing Tool MVP. Updated: 2026-04-07 (Session 3 complete).

## Project Knowledge

- **Purpose**: Auto-process invoice PDFs via OCR + AI extraction + schema matching
- **Stack**: Next.js 14 + NestJS 10 + Drizzle + SQLite + Gemini Flash
- **Users**: ~5 (operators + configurators), localhost deployment
- **Volume**: ~1000 PDFs/day, ~10 invoice types
- **AI**: Gemini 2.0 Flash for OCR + extraction (~$3/day)
- **Architecture**: Clean Architecture + DDD, 6 bounded contexts

## Current Progress

- **Phase**: Phase 1 — Foundation & Domain Core
- **Domain entities**: 8 implemented (Invoice, Schema, FingerprintRule, FieldDefinition, Batch, Product, SyncConflict, Mapping)
- **Value objects**: 3 implemented (TaxId, Money, Confidence)
- **Repository interfaces**: 8 created (IInvoiceRepository, IBatchRepository, ISchemaRepository, IFingerprintRuleRepository, IFieldDefinitionRepository, IProductRepository, ISyncConflictRepository, IMappingRepository)
- **Domain services**: 2 implemented (FingerprintService, ValidatorService)
- **Use cases**: 0 implemented
- **API endpoints**: 0 implemented
- **Frontend pages**: 0 implemented
- **Tests**: 163 domain tests (all passing)
- **Next session**: Session 4 — ConfidenceCalculator + FuzzyMatcher + PromptBuilder

## Bounded Contexts

| Context | Entities | Services | Status |
|---------|----------|----------|--------|
| INTAKE | Batch ✅, Invoice ✅ | FilePreprocessor, DedupChecker | Entities + repos done |
| PROCESSING | (uses Invoice ✅) | Pipeline, Classifier, Extractor, **ValidatorService ✅**, ConfidenceCalc, Router | Validator done |
| SCHEMA | Schema ✅, FingerprintRule ✅, FieldDefinition ✅ | **FingerprintService ✅**, PromptBuilder | Fingerprint done |
| CATALOG | Product ✅, SyncConflict ✅, Mapping ✅ | SyncService, FuzzyMatcher | Entities + repos done |
| REVIEW | (uses Invoice ✅) | ReviewService, AuditService | Entities done |
| OUTPUT | ExportJob, Notification | ExportService, NotificationService | Not started |

## Learned Rules

### Architecture
- FingerprintService uses plain data interface `FingerprintRuleData` instead of entity directly — decouples service from entity internals
- ValidatorService uses `ExtractedInvoiceData` plain interface — not the Invoice entity
- Domain services are stateless: no constructor DI, receive all data as method parameters

### NestJS / Drizzle
- (Will add patterns discovered during scaffolding)

### Gemini API
- (Will add prompt patterns discovered during integration)

### Testing
- Jest 30 is not compatible with ts-jest 29 — must use Jest 29.x
- ts-jest max version is 29.4.9 (as of 2026-04)
- IDE may show "Cannot find module" and "implicit any" lint errors in test files but `tsc --noEmit` and `jest` both pass — these are IDE TS server lag artifacts

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

## Key Files

| Resource | Path |
|---|---|
| Business Spec | `tasks/01-business-spec.md` |
| Database Design | `tasks/04-database-design.md` |
| Low-Level Design | `tasks/06-low-level-design.md` |
| Master Plan | `tasks/08-master-plan.md` |
| Session Handoff | `.context/session-handoff.md` |
| Config | `config.env` |
