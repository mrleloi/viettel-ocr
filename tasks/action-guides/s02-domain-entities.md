# Action Guide: Session 2 — Domain Entities & Value Objects

> Created: 2026-04-07 | Created by: Antigravity (Developer) — RETROACTIVE REWRITE
> Phase Step: 1.2 (from master plan § 7 Session Plan)
> Target Agent: Developer
> Status: ✅ COMPLETED — this guide rewritten post-session for documentation accuracy

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [x] Previous session completed: Session 1 — Project Scaffolding → check `.context/session-handoff.md`
- [x] Build passing: `cd invoice-tool/packages/backend && npx tsc --noEmit` → 0 errors
- [x] Tests passing: `cd invoice-tool && npm test -- --passWithNoTests` → pass (0 tests)
- [x] Required files exist:
  - `packages/shared/src/domain/invoice.ts` — InvoiceProps, InvoiceStatus types
  - `packages/shared/src/domain/schema.ts` — SchemaProps, SchemaStatus types
  - `packages/shared/src/domain/batch.ts` — BatchProps, BatchStatus types
  - `packages/shared/src/domain/product.ts` — ProductProps, ProductStatus types
  - `packages/shared/src/domain/mapping.ts` — MappingProps, MappingStatus types
  - `packages/shared/src/domain/confidence.ts` — ConfidenceThresholds types
  - `packages/backend/src/domain/` — directory exists (empty)

---

## 1. Context

### Business Requirement

Domain entities encode ALL business logic for the invoice processing tool. Each entity has:
- **Invariants** enforced on construction (e.g., invoiceNumber non-empty, fileSizeBytes > 0)
- **State machine** for lifecycle transitions (e.g., pending→processing→extracted→validated→approved)
- **Business methods** that enforce transition rules (e.g., can only approve from needs_review)

Reference: `tasks/01-business-spec.md` § F01 (Upload — Batch), § F02 (OCR — Invoice), § F03 (Classification — Schema/Fingerprint), § F04 (Validation), § F05 (Schema Management), § F06 (Products), § F07 (Mappings)

### Architecture Context

Domain layer in Clean Architecture — ZERO framework or infrastructure dependencies.

```
packages/backend/src/domain/
├── shared/           ← DomainError, identifier, value objects
├── invoice/          ← PROCESSING context
├── schema/           ← SCHEMA MANAGEMENT context
├── batch/            ← INTAKE context
├── product/          ← CATALOG context
└── mapping/          ← CATALOG context
```

Reference: `tasks/06-low-level-design.md` § 1 (Project Structure — domain layer)

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| `invoices` | InvoiceProps shape, status values, nullable fields |
| `batches` | BatchProps shape, status values, counter fields |
| `schemas` | SchemaProps shape, status lifecycle |
| `schema_fingerprint_rules` | FingerprintRuleProps, rule types |
| `schema_field_definitions` | FieldDefinitionProps, data types |
| `viettel_products` | ProductProps shape, sync status |
| `product_sync_conflicts` | SyncConflictProps, conflict types |
| `product_mappings` | MappingProps, source types, usage counting |

Reference: `tasks/04-database-design.md` § 2 (all table definitions)

### Data Flow

Entities represent the data objects that flow through the entire processing pipeline (Upload → Dedup → Classify → Extract → Validate → Map → Score → Route → Action). Session 2 defines their shapes and invariants; later sessions add the pipeline logic.

Reference: `tasks/05-data-flow-design.md` § 1 (Primary Flow — all stages)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — Entity pattern (private constructor, create/reconstitute, getters, toProps), Value Object pattern (immutable, self-validating, equals), Domain Service pattern
2. `.agents/skills/bdd-test-writing/skill.md` — Test structure (describe/it), fixture factory pattern, coverage requirements (happy + ≥2 edge + ≥1 error)
3. `.agents/skills/batch-implementation/skill.md` — Implementing 8+ entities: dependency-first order, incremental `jest --bail` after each item
4. `.agents/skills/quality-self-check/skill.md` — Verification iron law, architecture compliance checks

### Workflows (follow this one)
- `.agents/workflows/implement-domain.md` — Steps: read spec → write test (RED) → implement (GREEN) → verify → refactor

### Relevant Learned Rules
- Import types from `@invoice-tool/shared` is allowed (pure type interfaces)
- All dates as `Date` objects inside entities, string in DB
- Status enum values must match shared types package (source of truth)
- Entity IDs generated via `generateId()` (UUID v4)

---

## 3. Tasks (Ordered)

### Task 1: Shared Infrastructure

**Type**: GREEN (foundation — no test-first for utility code)
**Files**:
- `src/domain/shared/domain-error.ts` — Custom error class
- `src/domain/shared/identifier.ts` — UUID v4 wrapper

**Key types**:
```typescript
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}
```

---

### Task 2: Value Objects (RED → GREEN)

**Type**: RED (tests) → GREEN (implementation)
**Files**: 3 VOs + 3 test files

| VO | File | Business Rule | Edge Cases |
|----|------|--------------|------------|
| TaxId | `shared/value-objects/tax-id.vo.ts` | Vietnamese MST: `^\d{10}(-\d{3})?$` | Whitespace stripping, 13-digit with dash |
| Money | `shared/value-objects/money.vo.ts` | Integer VND, non-negative, arithmetic | Zero amount, tolerance (±1 VND) |
| Confidence | `shared/value-objects/confidence.vo.ts` | Range 0.0-1.0, threshold classification | Boundary 0/1, isHigh (≥0.95), isLow (<0.70) |

**Test cases per VO**: ≥4 (create valid, boundary, error, equals)

---

### Task 3: Entities (RED → GREEN per entity)

**Type**: RED → GREEN for each, in dependency order
**Order**: Invoice → Schema → FingerprintRule → FieldDefinition → Batch → Product → SyncConflict → Mapping

**Business rules per entity**:

| Entity | Key Rules | State Transitions |
|--------|----------|-------------------|
| Invoice | filename required, fileHash required, fileSizeBytes > 0, pageCount > 0 | pending→processing→extracted→validated→mapped→needs_review→approved/rejected, also: →duplicate, →error |
| Schema | name required, nccName required | draft→active↔inactive |
| FingerprintRule | schemaId required, ruleType in {mst_exact, mst_contains, keyword_contains, symbol_regex, custom_regex} | active↔inactive |
| FieldDefinition | schemaId required, fieldKey required, dataType in {string, integer, decimal, date, boolean} | — |
| Batch | totalFiles > 0, uploadMode in {specific_ncc, mixed, unknown} | uploading→processing→completed/partial/failed/cancelled |
| Product | productCode required, productName required | local_only→synced↔conflict |
| SyncConflict | productId required, conflictType required | unresolved→accepted/ignored/manually_resolved |
| Mapping | schemaId required, partnerProductName required, source in {manual, auto_learned, bulk_import, fuzzy_confirmed} | active/pending_review/inactive |

**Test cases per entity**: ≥5 (create, null optionals, reconstitute, toProps, state transitions, error cases)

---

## 4. Quality Gate

Run ALL of these before claiming done:

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

```powershell
# Build — from packages/backend/ directory
npx tsc --noEmit

# Tests — from packages/backend/ directory
npx jest --bail
# ⚠️ NEVER run `npx jest` from monorepo root — no jest config there

# Architecture checks — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
#   query ": any" in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [x] 3 value objects implemented with ≥4 test cases each
- [x] 8 entities implemented with ≥5 test cases each
- [x] All tests pass (fresh `jest --bail` output: 140 passed)
- [x] `tsc --noEmit` passes
- [x] Zero `@nestjs` imports in domain layer
- [x] Zero `any` types in domain layer
- [x] JSDoc on all public methods
- [x] Session handoff updated
- [x] Agent notes updated
- [x] Action guide for Session 3 created

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: 3 VOs + 8 entities + 140 domain tests
   - Found: InvoiceNumber/FileHash VOs inlined into entity validation
   - What's Next: "Session 3: Repository interfaces + FingerprintService + ValidatorService"

2. Update `.context/agent-notes.md`:
   - Progress counters (entities, VOs, tests)
   - Any new learned rules

3. Create action guide for Session 3: `tasks/action-guides/s03-repo-interfaces-domain-services.md`

4. Commit: `feat: implement domain entities and value objects (8 entities, 3 VOs, 140 tests)`

**Next session depends on**: All entity classes (repo interfaces return these types), all value objects
