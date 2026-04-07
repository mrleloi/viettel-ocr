# Action Guide: Session 3 — Repository Interfaces + FingerprintService + ValidatorService

> Created: 2026-04-07 | Created by: Antigravity (Developer)
> Phase Step: 1.3 + 1.4a (from master plan § 7 Session Plan)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 2 — Domain Entities & Value Objects → check `.context/session-handoff.md`
- [ ] Build passing: `cd invoice-tool/packages/backend && npx tsc --noEmit` → 0 errors
- [ ] Tests passing: `cd invoice-tool && npm test -- --bail` → all 140 green
- [ ] Required files exist:
  - `packages/backend/src/domain/shared/domain-error.ts`
  - `packages/backend/src/domain/shared/identifier.ts`
  - `packages/backend/src/domain/shared/value-objects/tax-id.vo.ts`
  - `packages/backend/src/domain/shared/value-objects/money.vo.ts`
  - `packages/backend/src/domain/shared/value-objects/confidence.vo.ts`
  - `packages/backend/src/domain/invoice/invoice.entity.ts`
  - `packages/backend/src/domain/schema/schema.entity.ts`
  - `packages/backend/src/domain/schema/fingerprint-rule.entity.ts`
  - `packages/backend/src/domain/schema/field-definition.entity.ts`
  - `packages/backend/src/domain/batch/batch.entity.ts`
  - `packages/backend/src/domain/product/product.entity.ts`
  - `packages/backend/src/domain/product/sync-conflict.entity.ts`
  - `packages/backend/src/domain/mapping/mapping.entity.ts`

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

Session 3 creates:
1. **Repository interfaces** — contracts that define how the domain persists/retrieves entities. These live in the domain layer (no implementation yet — that's Session 5).
2. **FingerprintService** — code-based invoice classifier that matches OCR text against schema fingerprint rules (MST exact, keyword, symbol regex). This is the ZERO-AI-COST first step before falling back to LLM.
3. **ValidatorService** — field-level + cross-field validation engine that checks extracted invoice data against business rules (required fields, format, total calculations).

Reference: `tasks/01-business-spec.md` § F03 (Classification & Fingerprinting) + § F04 (Validation Layer)

### Architecture Context

All code lives in `packages/backend/src/domain/` — ZERO framework imports.

- Repository **interfaces** go in `domain/{context}/` (e.g., `domain/invoice/invoice.repository.ts`)
- Repository **implementations** will be in `infrastructure/database/repositories/` (Session 5, not now)
- Domain services (FingerprintService, ValidatorService) go in their respective bounded contexts
- Services are stateless, receive data as parameters, return results — no DI needed at domain level

Reference: `tasks/06-low-level-design.md` § 1 (Project Structure) + § 2 (Key Domain Logic Details)

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| `invoices` | Repository interface: findById, findByBatchId, findDuplicate, save, updateStatus |
| `batches` | Repository interface: findById, save, updateStatus |
| `schemas` | Repository interface: findById, findActive, findByNccTaxId, save |
| `schema_fingerprint_rules` | FingerprintService reads these to classify invoices |
| `schema_field_definitions` | ValidatorService reads these to know which fields to validate |
| `viettel_products` | Repository interface: findById, findByCode, search, save |
| `product_mappings` | Repository interface: findByPartnerName, findBySchemaId, save |
| `product_sync_conflicts` | Repository interface: findUnresolved, save, resolve |

Reference: `tasks/04-database-design.md` § 2 (Table Definitions)

### Data Flow

- FingerprintService runs at **Stage 3: CLASSIFY** in the processing pipeline
- ValidatorService runs at **Stage 5: VALIDATE** in the processing pipeline

Reference: `tasks/05-data-flow-design.md` § 1 (Primary Flow) — Stages 3 and 5

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — Repository interface pattern, domain service pattern
2. `.agents/skills/bdd-test-writing/skill.md` — Test structure, fixture pattern, coverage requirements
3. `.agents/skills/batch-implementation/skill.md` — Implementing 3+ items: dependency order, incremental verify
4. `.agents/skills/quality-self-check/skill.md` — Verification before completion

### Workflows (follow this one)
- `.agents/workflows/implement-domain.md` — Steps: spec → test → entity → verify

### Relevant Learned Rules
- Domain layer ZERO framework imports — no `@nestjs/*`, `drizzle-orm`, `fs`, `path`
- Private constructor + static `create()` / `reconstitute()` pattern for entities
- Import types from `@invoice-tool/shared` is allowed (pure type imports)
- All tests use factory functions per file (never shared mutable state)
- Session handoff was not updated after Session 2 — now fixed
- Action guide must be created at session end for next session

---

## 3. Tasks (Ordered)

### Task 1: Repository Interfaces (RED → GREEN)

**Type**: RED (write interface files) → GREEN (types compile)
**Files to create**:

| File | Interface Name | Key Methods |
|------|---------------|-------------|
| `domain/invoice/invoice.repository.ts` | `IInvoiceRepository` | `findById`, `findByBatchId`, `findByFileHash`, `findDuplicate(symbol, number, sellerTaxId)`, `save`, `updateStatus` |
| `domain/batch/batch.repository.ts` | `IBatchRepository` | `findById`, `findRecent(limit)`, `save`, `updateCounters` |
| `domain/schema/schema.repository.ts` | `ISchemaRepository` | `findById`, `findActive()`, `findByNccTaxId(taxId)`, `save` |
| `domain/schema/fingerprint-rule.repository.ts` | `IFingerprintRuleRepository` | `findBySchemaId`, `findAllActive()`, `save`, `delete` |
| `domain/schema/field-definition.repository.ts` | `IFieldDefinitionRepository` | `findBySchemaId`, `save`, `delete` |
| `domain/product/product.repository.ts` | `IProductRepository` | `findById`, `findByCode`, `findAll()`, `search(query)`, `save` |
| `domain/mapping/mapping.repository.ts` | `IMappingRepository` | `findByPartnerName(name, schemaId)`, `findBySchemaId`, `save`, `incrementUsage(id)` |
| `domain/product/sync-conflict.repository.ts` | `ISyncConflictRepository` | `findUnresolved()`, `save`, `resolve(id, resolution)` |

**Key types**:
```typescript
// All repository interfaces follow this pattern:
export interface IInvoiceRepository {
  /** Find invoice by ID, returns null if not found */
  findById(id: string): Promise<Invoice | null>;
  /** Find all invoices in a batch */
  findByBatchId(batchId: string): Promise<Invoice[]>;
  /** Find exact duplicate by file hash */
  findByFileHash(fileHash: string): Promise<Invoice | null>;
  /** Find logical duplicate (same symbol + number + seller MST) */
  findDuplicate(symbol: string, number: string, sellerTaxId: string): Promise<Invoice | null>;
  /** Persist (insert or update) */
  save(invoice: Invoice): Promise<void>;
  /** Update status only (optimized for pipeline) */
  updateStatus(id: string, status: InvoiceStatus): Promise<void>;
}
```

**Verify**: `cd invoice-tool/packages/backend && npx tsc --noEmit` → 0 errors

---

### Task 2: FingerprintService (RED → GREEN → REFACTOR)

**Type**: RED (tests) → GREEN (implementation)
**File**: `packages/backend/src/domain/schema/fingerprint.service.ts`
**Test**: `packages/backend/src/domain/schema/__tests__/fingerprint.service.spec.ts`

**What to do**:

Implement a stateless service that classifies invoices by running fingerprint rules against OCR text.

**Key types**:
```typescript
// Input
interface FingerprintInput {
  ocrText: string;
  sellerTaxId?: string;
  invoiceSymbol?: string;
}

// Output
interface FingerprintResult {
  matched: boolean;
  schemaId: string | null;
  score: number;           // 0.0 - 1.0
  matchedRules: string[];  // IDs of rules that matched
  method: 'mst_exact' | 'keyword' | 'symbol_regex' | 'custom' | null;
}

// Rules come from FingerprintRule entities
interface FingerprintRuleData {
  id: string;
  schemaId: string;
  ruleType: 'mst_exact' | 'mst_contains' | 'keyword_contains' | 'symbol_regex' | 'custom_regex';
  ruleField: 'full_text' | 'seller_tax_id' | 'invoice_symbol' | 'header';
  ruleValue: string;
  priority: number;
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| MST exact match | `sellerTaxId === rule.ruleValue` → score 1.0 | Tax ID with/without dashes, whitespace |
| MST contains | `ocrText.includes(rule.ruleValue)` → score 0.9 | MST appearing in buyer section vs seller |
| Keyword contains | `ocrText.toLowerCase().includes(rule.ruleValue.toLowerCase())` → score 0.7 | Partial keyword match, case sensitivity |
| Symbol regex | `new RegExp(rule.ruleValue).test(invoiceSymbol)` → score 0.8 | Invalid regex patterns (should not throw) |
| Custom regex | `new RegExp(rule.ruleValue).test(ocrText)` → score 0.6 | Invalid regex, multiline text |
| Priority ordering | Rules sorted by priority (lower = higher) → first match per schema wins | Multiple schemas matching same text |
| Best schema | If multiple schemas match, return highest-scoring one | Tie-breaking: prefer higher priority rule |
| No match | Return `{ matched: false, schemaId: null, score: 0 }` | Empty OCR text, no active rules |

**Test cases required** (≥8):
1. ✅ Happy: MST exact match → returns schema with score 1.0
2. ✅ Happy: Keyword match → returns schema with score 0.7
3. ✅ Happy: Symbol regex match → returns schema with score 0.8
4. ✅ Edge: Multiple schemas, selects highest scoring
5. ✅ Edge: Same schema, multiple rules — uses highest priority
6. ✅ Edge: Tax ID with whitespace/dashes — still matches
7. ❌ Error: No rules → returns no match
8. ❌ Error: Invalid regex → handles gracefully (no throw)
9. ❌ Error: Empty OCR text → returns no match

**Verify**: `cd invoice-tool && npx jest --testPathPattern="fingerprint.service" --bail`

---

### Task 3: ValidatorService (RED → GREEN → REFACTOR)

**Type**: RED (tests) → GREEN (implementation)
**File**: `packages/backend/src/domain/processing/validator.service.ts`
**Test**: `packages/backend/src/domain/processing/__tests__/validator.service.spec.ts`

**What to do**:

Implement a stateless validation engine that checks extracted invoice data against field-level and cross-field business rules.

**Key types**:
```typescript
// Output
interface ValidationError {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  expected?: string;
  actual?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  passRate: number; // 0-1: ratio of rules passed vs total
}

// Input — extracted invoice data as plain object
interface ExtractedInvoiceData {
  invoiceNumber: string | null;
  invoiceSymbol: string | null;
  invoiceDate: string | null;
  sellerTaxId: string | null;
  buyerTaxId: string | null;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  total: number | null;
  lineItems: Array<{
    name: string | null;
    quantity: number | null;
    unitPrice: number | null;
    amount: number | null;
  }>;
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| invoice_number required | non-null, non-empty string | Empty string vs null |
| invoice_symbol required | non-null, non-empty string | Whitespace-only |
| invoice_date valid | valid date, not future, not older than 180 days | Boundary dates, invalid format |
| seller_tax_id format | `^\d{10}(-\d{3})?$` | With/without dash, wrong digit count |
| buyer_tax_id format | Same as seller | Same edge cases |
| vat_rate valid | Must be in {0, 5, 8, 10} | null (warning), other values (error) |
| vat_amount = subtotal × vat_rate / 100 | ±1 VND tolerance | Rounding, null subtotal |
| total = subtotal + vat_amount | ±1 VND tolerance | Rounding, null fields |
| line_items count | At least 1 item | Empty array, null |
| line_item.amount = qty × unitPrice | Exact or ±1 VND | Missing fields |
| line_items_sum ≈ subtotal | Sum of amounts ≈ subtotal (±configurable) | Float precision |

**Test cases required** (≥10):
1. ✅ Happy: All fields valid → valid, empty errors
2. ✅ Happy: Valid with line items matching subtotal
3. ✅ Edge: VAT amount off by 1 VND → still passes (tolerance)
4. ✅ Edge: Total off by exactly 1 VND → passes
5. ✅ Edge: Total off by 2 VND → fails
6. ✅ Edge: null optional fields → warnings, not errors
7. ✅ Edge: Invoice date exactly 180 days ago → passes
8. ✅ Edge: Invoice date 181 days ago → warning
9. ❌ Error: Missing invoice_number → error
10. ❌ Error: Invalid tax ID format → error
11. ❌ Error: Future invoice date → error
12. ❌ Error: Invalid VAT rate → error
13. ❌ Error: No line items → error

**Verify**: `cd invoice-tool && npx jest --testPathPattern="validator.service" --bail`

---

### Task 4: Register & Barrel Exports

After all tests pass, ensure barrel exports:
- Create `domain/invoice/index.ts` barrel (if not exists)
- Create `domain/schema/index.ts` barrel
- Create `domain/batch/index.ts` barrel
- Create `domain/product/index.ts` barrel
- Create `domain/mapping/index.ts` barrel
- Create `domain/processing/index.ts` barrel (new directory)

---

## 4. Quality Gate

Run ALL of these before claiming done:

```bash
# Build
cd invoice-tool/packages/backend && npx tsc --noEmit

# Tests (all — including Session 2's 140 + new ones)
cd invoice-tool && npm test -- --bail

# Architecture check (domain layer purity)
grep -r "@nestjs" packages/backend/src/domain/ | wc -l          # expect 0
grep -r "drizzle-orm" packages/backend/src/domain/ | wc -l      # expect 0
grep -r ": any" packages/backend/src/domain/ | wc -l            # expect 0
grep -r "import.*from.*infrastructure" packages/backend/src/domain/ | wc -l  # expect 0
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] 8 repository interfaces created (one per entity/aggregate)
- [ ] FingerprintService implemented with ≥8 test cases all passing
- [ ] ValidatorService implemented with ≥10 test cases all passing
- [ ] All 140+ previous domain tests still pass (no regressions)
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] 0 framework imports in domain layer (`@nestjs`, `drizzle-orm`, `fs`, `path`)
- [ ] 0 `any` types in domain layer
- [ ] JSDoc on all public methods
- [ ] Session handoff updated
- [ ] Agent notes updated
- [ ] Action guide for Session 4 created

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Repository interfaces + FingerprintService + ValidatorService
   - Found: Any surprises or design decisions
   - What's Next: "Session 4: Phase Step 1.4b — ConfidenceCalculator + FuzzyMatcher + PromptBuilder"

2. Update `.context/agent-notes.md`:
   - Progress counters (domain services count)
   - Any new learned rules

3. Create action guide for Session 4: `tasks/action-guides/s04-confidence-fuzzy-prompt.md`
   - Follow `.agents/skills/action-guide-creator/skill.md` template
   - Scope: ConfidenceCalculator, FuzzyMatcher, PromptBuilder domain services

4. Commit: `feat: add repo interfaces + fingerprint + validator services`

**Next session depends on**: All repository interfaces (Session 4's services may reference them via dependency injection in tests)
