# Action Guide: Session 5 — Database Repositories (Drizzle + SQLite)

> Created: 2026-04-07 | Created by: Antigravity (Developer)
> Phase Step: 2.1 (from master plan § 7 Session Plan)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 4 — ConfidenceCalculator + FuzzyMatcher + PromptBuilder → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → all 193 green
- [ ] Required files exist:
  - `packages/backend/src/domain/invoice/invoice.repository.ts` — IInvoiceRepository
  - `packages/backend/src/domain/batch/batch.repository.ts` — IBatchRepository
  - `packages/backend/src/domain/schema/schema.repository.ts` — ISchemaRepository
  - `packages/backend/src/domain/schema/fingerprint-rule.repository.ts` — IFingerprintRuleRepository
  - `packages/backend/src/domain/schema/field-definition.repository.ts` — IFieldDefinitionRepository
  - `packages/backend/src/domain/product/product.repository.ts` — IProductRepository
  - `packages/backend/src/domain/product/sync-conflict.repository.ts` — ISyncConflictRepository
  - `packages/backend/src/domain/mapping/mapping.repository.ts` — IMappingRepository
  - `packages/backend/src/infrastructure/database/schema.ts` — Drizzle table definitions
  - `packages/backend/src/infrastructure/database/connection.ts` — DB connection factory
  - `packages/backend/src/infrastructure/database/database.module.ts` — NestJS module

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

The domain layer (entities, value objects, repository interfaces, domain services) is complete (Phase 1). Now the infrastructure layer needs concrete database implementations — Drizzle ORM repositories backed by SQLite — so that use cases can persist and query data.

Reference: `tasks/01-business-spec.md` (all features need data persistence)

### Architecture Context

Repository implementations live in `packages/backend/src/infrastructure/database/repositories/`. Each implements a domain repository interface (from `domain/{context}/{entity}.repository.ts`) using Drizzle ORM + SQLite.

The pattern:
- `@Injectable()` NestJS service
- Constructor receives `DrizzleDB` via `@Inject('DB')`
- `toDomain()` maps DB row → entity props → `Entity.reconstitute()`
- `toPersistence()` maps entity → DB insert/update values
- JSON fields: `JSON.parse()` on read, `JSON.stringify()` on write
- Dates: ISO string in SQLite, passed as-is to domain (domain handles strings)

Reference: `tasks/06-low-level-design.md` § 1 (Project Structure → infrastructure/database/repositories/)

### Database Tables Involved

| Table | Repository | Domain Interface |
|-------|-----------|-----------------|
| `invoices` | InvoiceRepositoryImpl | IInvoiceRepository |
| `batches` | BatchRepositoryImpl | IBatchRepository |
| `schemas` | SchemaRepositoryImpl | ISchemaRepository |
| `schema_fingerprint_rules` | FingerprintRuleRepositoryImpl | IFingerprintRuleRepository |
| `schema_field_definitions` | FieldDefinitionRepositoryImpl | IFieldDefinitionRepository |
| `viettel_products` | ProductRepositoryImpl | IProductRepository |
| `product_sync_conflicts` | SyncConflictRepositoryImpl | ISyncConflictRepository |
| `product_mappings` | MappingRepositoryImpl | IMappingRepository |

Reference: `tasks/04-database-design.md` § 2 (all table definitions)

### Data Flow

Repository implementations are used by application-layer use cases (Phase 2.4). At this phase, we implement and test the repositories standalone with integration tests using in-memory SQLite.

Reference: `tasks/05-data-flow-design.md` § 1 (Primary Flow — all stages read/write via repositories)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/repository-implementation/skill.md` — Drizzle repo pattern, toDomain/toPersistence, testing approach
2. `.agents/skills/bdd-test-writing/skill.md` — Integration test structure, factory patterns
3. `.agents/skills/batch-implementation/skill.md` — 8 repos to implement, dependency ordering, incremental verify
4. `.agents/skills/quality-self-check/skill.md` — Verification before completion

### Workflows (follow this one)
- `.agents/workflows/session-handoff.md` — Session lifecycle (orient → plan → implement → verify → handoff)

### Relevant Learned Rules
- Domain services use plain data interfaces — repositories map between entities and DB rows
- Entity uses `reconstitute()` (not `create()`) when loading from DB — skips validation
- JSON fields: `JSON.parse()` on read, `JSON.stringify()` on write
- Dates stored as ISO strings in SQLite
- Jest 29.x must be used (not 30) — ts-jest compatibility
- `npx jest` must run from `packages/backend/` directory, never from monorepo root
- OS is Windows + PowerShell — do not use bash syntax in commands

---

## 3. Tasks (Ordered)

### Task 1: Verify Drizzle Schema Completeness

**Type**: Verification (no code change expected)
**File**: `packages/backend/src/infrastructure/database/schema.ts`

**What to do**:
Read `schema.ts` and verify all 17 tables from `tasks/04-database-design.md` are defined. If any are missing, add them.

---

### Task 2: Create DB Connection Test Helper

**Type**: GREEN (setup)
**File**: `packages/backend/src/infrastructure/database/__tests__/test-db.helper.ts`

**What to do**:
Create a test helper that creates in-memory SQLite DB with Drizzle, runs schema creation, and provides the DB instance for tests.

**Key types**:
```typescript
export async function createTestDb(): Promise<DrizzleDB> {
  // Create in-memory SQLite
  // Apply schema (create tables)
  // Return Drizzle instance
}
```

---

### Task 3-10: Repository Implementations (RED → GREEN for each)

Implement in this dependency order (entities without FK deps first):

1. **SchemaRepositoryImpl** — `schemas` table (no FK deps)
2. **FingerprintRuleRepositoryImpl** — `schema_fingerprint_rules` (FK → schemas)
3. **FieldDefinitionRepositoryImpl** — `schema_field_definitions` (FK → schemas)
4. **BatchRepositoryImpl** — `batches` table (FK → schemas optional)
5. **ProductRepositoryImpl** — `viettel_products` table (no FK deps)
6. **SyncConflictRepositoryImpl** — `product_sync_conflicts` (FK → products)
7. **MappingRepositoryImpl** — `product_mappings` (FK → products)
8. **InvoiceRepositoryImpl** — `invoices` table (FK → batches, schemas)

For each repository:

**File**: `packages/backend/src/infrastructure/database/repositories/{entity}.repository.impl.ts`
**Test**: `packages/backend/src/infrastructure/database/repositories/__tests__/{entity}.repository.impl.spec.ts`

**Pattern per repo**:
```typescript
@Injectable()
export class SchemaRepositoryImpl implements ISchemaRepository {
  constructor(@Inject('DB') private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Schema | null> { ... }
  async save(entity: Schema): Promise<void> { ... }

  private toDomain(row: ...): SchemaProps { ... }
  private toPersistence(entity: Schema): ... { ... }
}
```

**Test cases per repo** (≥4):
1. ✅ Save + findById roundtrip
2. ✅ findById returns null when not found
3. ✅ Save existing entity (upsert) updates fields
4. ✅ Query methods (e.g., findByStatus, findByBatchId) with filters
5. ❌ Edge: JSON fields serialized/deserialized correctly

**Verify after each**: `npx jest --testPathPattern="{entity}.repository" --bail`

---

### Task 11: NestJS Module Registration

**Type**: GREEN (wiring)
**File**: `packages/backend/src/infrastructure/database/database.module.ts`

**What to do**:
Register all 8 repository implementations as NestJS providers. Use injection tokens matching the domain interface names.

```typescript
const repositories = [
  { provide: 'IInvoiceRepository', useClass: InvoiceRepositoryImpl },
  { provide: 'IBatchRepository', useClass: BatchRepositoryImpl },
  // ... etc
];
```

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from packages/backend/ directory
npx tsc --noEmit

# Tests — from packages/backend/ directory (OR `npm test` from monorepo root)
npx jest --bail
# ⚠️ NEVER run `npx jest` from monorepo root — no jest config there

# Architecture checks — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
#   query ": any" in packages/backend/src/domain/  → expect 0 results
#   query "from.*infrastructure" (regex) in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] All 8 repository implementations created and implementing domain interfaces
- [ ] Each repository has ≥4 integration tests using in-memory SQLite
- [ ] All 193+ previous domain tests still pass (no regressions)
- [ ] New integration tests all pass
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] NestJS module registers all 8 repositories
- [ ] toDomain/toPersistence methods handle all entity props
- [ ] JSON fields properly serialized/deserialized
- [ ] 0 framework imports in domain layer (architecture preserved)
- [ ] Session handoff updated
- [ ] Agent notes updated
- [ ] Progress tracker updated
- [ ] Action guide for Session 6 created

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: 8 repository implementations + integration tests
   - Found: Any issues with Drizzle schema or entity mapping
   - What's Next: "Session 6: Phase Step 2.2 — GeminiClient + ViettelClient + MockServer + FileStorage"

2. Update `.context/agent-notes.md`:
   - Progress counters (repository implementations count → 8 total)
   - Any Drizzle/SQLite learned rules

3. Update `tasks/progress.md`:
   - Mark Step 2.1 as done

4. Create action guide for Session 6: `tasks/action-guides/s06-external-integrations.md`

5. Commit: `feat: add drizzle repository implementations for all 8 domain interfaces`

**Next session depends on**: All repositories working so use cases can be wired in Phase 2.4.
