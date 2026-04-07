# Action Guide: Session 4 — ConfidenceCalculator + FuzzyMatcher + PromptBuilder

> Created: 2026-04-07 | Created by: Antigravity (Developer)
> Phase Step: 1.4b (from master plan § 7 Session Plan)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 3 — Repository Interfaces + FingerprintService + ValidatorService → check `.context/session-handoff.md`
- [ ] Build passing: `cd invoice-tool/packages/backend && npx tsc --noEmit` → 0 errors
- [ ] Tests passing: `cd invoice-tool/packages/backend && npx jest --bail` → all 163 green
- [ ] Required files exist:
  - `packages/backend/src/domain/processing/validator.service.ts`
  - `packages/backend/src/domain/schema/fingerprint.service.ts`
  - `packages/backend/src/domain/invoice/invoice.repository.ts`
  - `packages/backend/src/domain/schema/schema.repository.ts`
  - `packages/backend/src/domain/mapping/mapping.repository.ts`
  - `packages/backend/src/domain/product/product.repository.ts`

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

Session 4 creates the final 3 domain services for Phase 1:
1. **ConfidenceCalculator** — calculates a composite confidence score for processed invoices using weighted factors (frontend hint match, fingerprint score, extraction quality, validation pass rate, mapping completeness) with penalties for disagreements and missing required fields.
2. **FuzzyMatcher** — finds best-matching Viettel products for partner product names using token-based similarity (Jaccard + LCS + brand bonus). Enables auto-mapping and suggestions.
3. **PromptBuilder** — constructs Gemini API prompts from schema templates + field definitions. Supports known-schema (optimized) and unknown-schema (classification) modes.

Reference: `tasks/06-low-level-design.md` § 2.2 (Confidence Calculator), § 2.5 (Fuzzy Matcher), § 3 (Gemini API Integration)

### Architecture Context

All code lives in `packages/backend/src/domain/` — ZERO framework imports.

- ConfidenceCalculator → `domain/processing/confidence-calculator.service.ts`
- FuzzyMatcher → `domain/mapping/fuzzy-matcher.service.ts`
- PromptBuilder → `domain/schema/prompt-builder.service.ts`

All three are stateless domain services — receive data as parameters, return results. No DI needed at domain level.

Reference: `tasks/06-low-level-design.md` § 1 (Project Structure)

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| `schemas` | PromptBuilder reads promptTemplate and schema info to build prompts |
| `schema_field_definitions` | PromptBuilder reads field definitions for extraction hints |
| `viettel_products` | FuzzyMatcher searches against product names/codes |
| `product_mappings` | FuzzyMatcher results used for auto-mapping |
| `invoices` | ConfidenceCalculator scores are set on invoice entities |

Reference: `tasks/04-database-design.md` § 2 (Table Definitions)

### Data Flow

- ConfidenceCalculator runs at **Stage 6: SCORE** in the processing pipeline
- FuzzyMatcher runs at **Stage 5: MAP** in the processing pipeline  
- PromptBuilder runs at **Stage 3: CLASSIFY** (unknown schema) and **Stage 4: EXTRACT**

Reference: `tasks/05-data-flow-design.md` § 1 (Primary Flow)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — Domain service pattern (stateless, pure logic)
2. `.agents/skills/bdd-test-writing/skill.md` — Test structure, fixture pattern, coverage requirements
3. `.agents/skills/batch-implementation/skill.md` — Implementing 3+ items: dependency order, incremental verify
4. `.agents/skills/quality-self-check/skill.md` — Verification before completion

### Workflows (follow this one)
- `.agents/workflows/implement-domain.md` — Steps: spec → test → entity → verify

### Relevant Learned Rules
- Domain layer ZERO framework imports — no `@nestjs/*`, `drizzle-orm`, `fs`, `path`
- Domain services are stateless: no constructor DI, receive all data as method parameters
- FingerprintService uses plain data interface (not entity) — apply same pattern here
- Import types from `@invoice-tool/shared` is allowed (pure type imports)
- All tests use factory functions per file (never shared mutable state)
- Jest 30 not compatible with ts-jest 29 — currently using Jest 29.7

---

## 3. Tasks (Ordered)

### Task 1: ConfidenceCalculator (RED → GREEN → REFACTOR)

**Type**: RED (tests) → GREEN (implementation)
**File**: `packages/backend/src/domain/processing/confidence-calculator.service.ts`
**Test**: `packages/backend/src/domain/processing/__tests__/confidence-calculator.service.spec.ts`

**What to do**:

Implement a stateless service that calculates a composite confidence score for a processed invoice. The score determines whether the invoice is auto-approved or routed to human review.

**Key types**:
```typescript
interface ConfidenceInput {
  classificationMethod: 'frontend_hint' | 'fingerprint' | 'llm' | 'manual';
  fingerprintScore: number;          // 0.0-1.0 from FingerprintService
  fieldConfidences: Record<string, number>;  // field_name → confidence (0.0-1.0)
  requiredFields: string[];          // field names that are required
  validationPassRate: number;        // 0-1: ratio of passed validation rules
  mappingCompleteness: number;       // 0-1: ratio of mapped line items
  hintMatchesFingerprint: boolean;   // frontend hint matches fingerprint result?
  hasHint: boolean;                  // was a frontend hint provided?
}

interface ConfidenceResult {
  overallScore: number;              // 0.0-1.0 final composite score
  componentScores: {
    hintScore: number;
    fingerprintScore: number;
    extractionQuality: number;
    validationScore: number;
    mappingScore: number;
  };
  penalties: string[];               // descriptions of applied penalties
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Hint score weight | 0.30 of total. 1.0 if hint+matches fingerprint, 0.5 if hint but no fingerprint match, 0.0 if no hint | No hint at all, hint disagrees |
| Fingerprint weight | 0.25 of total. Direct from fingerprintScore input | Score is 0 (no match) |
| Extraction quality weight | 0.25 of total. Average of non-null field confidences | All fields null → 0.0 |
| Validation weight | 0.10 of total. Direct from validationPassRate | 0 pass rate |
| Mapping weight | 0.10 of total. Direct from mappingCompleteness | No line items → 0.0 |
| Hint disagrees penalty | -0.20 when hint provided but fingerprint says different schema | Edge: no fingerprint result |
| Missing required fields penalty | -0.05 per required field with null confidence | All required fields present |
| Score clamping | Final score clamped to [0.0, 1.0] | Heavy penalties pushing below 0 |

**Test cases required** (≥8):
1. ✅ Happy: All high scores → overall > 0.85
2. ✅ Happy: Frontend hint matches fingerprint → full hint score (0.30)
3. ✅ Edge: No frontend hint → hint component = 0
4. ✅ Edge: Hint provided but no fingerprint match → hint = 0.5
5. ✅ Edge: Hint disagrees with fingerprint → -0.20 penalty
6. ✅ Edge: All field confidences null → extraction quality = 0
7. ✅ Edge: Missing required fields → -0.05 per field penalty
8. ❌ Error: Heavy penalties → score clamped at 0.0 (never negative)
9. ❌ Error: Empty fieldConfidences → extraction quality = 0

**Verify**: `cd invoice-tool/packages/backend && npx jest --testPathPattern="confidence-calculator" --bail`

---

### Task 2: FuzzyMatcher (RED → GREEN → REFACTOR)

**Type**: RED (tests) → GREEN (implementation)
**File**: `packages/backend/src/domain/mapping/fuzzy-matcher.service.ts`
**Test**: `packages/backend/src/domain/mapping/__tests__/fuzzy-matcher.service.spec.ts`

**What to do**:

Implement a stateless service that finds best-matching Viettel products for a given partner product name using token-based fuzzy matching.

**Key types**:
```typescript
interface ProductData {
  id: string;
  productCode: string;
  productName: string;
  brand: string | null;
}

interface FuzzyMatchResult {
  productId: string;
  productCode: string;
  productName: string;
  score: number;           // 0.0 - 1.0
}

interface FuzzyMatchOptions {
  topN?: number;           // default 5
  threshold?: number;      // default 0.3
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Normalize | lowercase, strip Vietnamese diacritics, remove common stop words | Input with diacritics, MiXeD CaSe |
| Tokenize | Split by spaces and special chars (,./\-) | Single-word names |
| Jaccard similarity | intersection / union of token sets | Completely disjoint sets → 0 |
| LCS ratio | Longest common subsequence / max length | Very short strings |
| Brand bonus | +0.15 if any brand token found in partner name | No brand info (null) |
| Final score | 0.5 × jaccard + 0.3 × lcs_ratio + 0.2 × brand_bonus | All components 0 |
| Threshold filter | Only return results above threshold (default 0.3) | All scores below threshold |
| Top N | Return at most N results (default 5) | Fewer than N above threshold |
| Sort | Results sorted descending by score | Multiple same score |

**Test cases required** (≥8):
1. ✅ Happy: Exact match → score = 1.0
2. ✅ Happy: Close match with brand bonus
3. ✅ Happy: Multiple results sorted by score
4. ✅ Edge: Vietnamese diacritics normalized → still matches
5. ✅ Edge: No matches above threshold → empty array
6. ✅ Edge: Brand null → no bonus applied
7. ✅ Edge: Single-word product name
8. ❌ Error: Empty product list → empty results
9. ❌ Error: Empty search query → empty results

**Verify**: `cd invoice-tool/packages/backend && npx jest --testPathPattern="fuzzy-matcher" --bail`

---

### Task 3: PromptBuilder (RED → GREEN → REFACTOR)

**Type**: RED (tests) → GREEN (implementation)
**File**: `packages/backend/src/domain/schema/prompt-builder.service.ts`
**Test**: `packages/backend/src/domain/schema/__tests__/prompt-builder.service.spec.ts`

**What to do**:

Implement a stateless service that builds Gemini API prompts from schema data and field definitions. Supports two modes: known schema (extraction only) and unknown schema (classification + extraction).

**Key types**:
```typescript
interface SchemaData {
  id: string;
  name: string;
  description: string | null;
  nccName: string;
  nccTaxId: string;
  promptTemplate: string | null;
}

interface FieldData {
  fieldName: string;
  displayName: string;
  dataType: 'string' | 'integer' | 'number' | 'date' | 'boolean';
  isRequired: boolean;
  extractionHint: string | null;
}

interface BuiltPrompt {
  systemPrompt: string;
  extractionPrompt: string;
}
```

**Business rules to encode**:

| Rule | Logic | Edge case |
|------|-------|-----------|
| Known schema mode | Build extraction-only prompt with field list | Schema has no custom promptTemplate |
| Unknown schema mode | Prepend classification section with all schema options | Empty schemas list |
| Field list | Include field name, display name, data type, extraction hint | No extraction hint |
| Required field marker | Mark required fields in prompt | All fields optional |
| Custom template | Use schema.promptTemplate if available, otherwise default | null template |
| JSON output | Prompt instructs model to return JSON only | N/A |
| Vietnamese context | Include Vietnamese field name translations | N/A |

**Test cases required** (≥8):
1. ✅ Happy: Known schema with custom template → includes template
2. ✅ Happy: Known schema with field definitions → lists all fields
3. ✅ Happy: Unknown schema with multiple schema options → lists schemas for classification
4. ✅ Edge: Schema with no custom template → uses default
5. ✅ Edge: Fields with extraction hints → includes hints in prompt
6. ✅ Edge: Required vs optional fields → marked correctly in prompt
7. ❌ Error: Empty field list → still produces valid prompt
8. ❌ Error: Unknown schema mode with empty schemas → still produces valid prompt

**Verify**: `cd invoice-tool/packages/backend && npx jest --testPathPattern="prompt-builder" --bail`

---

### Task 4: Update Barrel Exports

After all tests pass, update barrel exports:
- Update `domain/processing/index.ts` — add ConfidenceCalculator exports
- Update `domain/mapping/index.ts` — add FuzzyMatcher exports
- Update `domain/schema/index.ts` — add PromptBuilder exports

---

## 4. Quality Gate

Run ALL of these before claiming done:

```bash
# Build
cd invoice-tool/packages/backend && npx tsc --noEmit

# Tests (all — including Session 3's 163 + new ones)
cd invoice-tool/packages/backend && npx jest --bail

# Architecture check (domain layer purity)
grep -r "@nestjs" packages/backend/src/domain/ | wc -l          # expect 0
grep -r "drizzle-orm" packages/backend/src/domain/ | wc -l      # expect 0
grep -r ": any" packages/backend/src/domain/ | wc -l            # expect 0
grep -r "import.*from.*infrastructure" packages/backend/src/domain/ | wc -l  # expect 0
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] ConfidenceCalculator implemented with ≥8 test cases all passing
- [ ] FuzzyMatcher implemented with ≥8 test cases all passing
- [ ] PromptBuilder implemented with ≥8 test cases all passing
- [ ] All 163+ previous tests still pass (no regressions)
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] 0 framework imports in domain layer
- [ ] 0 `any` types in domain layer
- [ ] JSDoc on all public methods
- [ ] Barrel exports updated for processing, mapping, schema
- [ ] Session handoff updated
- [ ] Agent notes updated
- [ ] Action guide for Session 5 created

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: ConfidenceCalculator + FuzzyMatcher + PromptBuilder
   - Found: Any surprises or design decisions
   - What's Next: "Session 5: Phase Step 2.1 — Database Schema (Drizzle) + Repository Implementations"

2. Update `.context/agent-notes.md`:
   - Progress counters (domain services count → 5 total)
   - Any new learned rules

3. Create action guide for Session 5: `tasks/action-guides/s05-database-repositories.md`
   - Follow `.agents/skills/action-guide-creator/skill.md` template
   - Scope: Drizzle table definitions + concrete repository implementations for all 8 interfaces

4. Commit: `feat: add confidence calculator + fuzzy matcher + prompt builder`

**Next session depends on**: All domain services complete (Phase 1 done). Session 5 starts infrastructure layer.
