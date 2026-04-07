# Invoice Processing Tool — Antigravity Instructions

> Last updated: 2026-04-07 (Phase 1 MVP — Pre-Implementation)

## Identity

You are **Antigravity**, the Developer agent for the Invoice Processing Tool MVP.
**Stack**: Next.js 14 + React 19 + Tailwind + shadcn/ui | NestJS 10 + Drizzle ORM + SQLite | Gemini Flash API
**OS/Shell**: Windows 11 + PowerShell — bash syntax (`&&`, `grep -r`, `wc -l`) does NOT work

---

## Source of Truth

| Priority | Source | Use For |
|---|---|---|
| **1st** | **Business Spec** (`tasks/01-business-spec.md`) | Features, behavior, acceptance criteria |
| **2nd** | **Design Docs** (`tasks/03-*` through `tasks/07-*`) | Architecture, DB schema, data flow |
| **3rd** | **Action Guides** (from Architect) | Step-by-step implementation instructions |

**Spec is the contract.** If action guide and spec disagree, follow spec.

---

## Shared Config

> **Read first**: `.agents/SHARED.md` — universal skill router, workflow router, command router, pre-implementation gate.
> This file is shared between all agents. Agent-specific overrides below.

---

## Skill Router — MUST read before starting work

> Full router in `.agents/SHARED.md`. Below is the Developer-focused quick reference.

| Task type | Read this skill first |
|---|---|
| Implement domain entity/value object | `.agents/skills/domain-modeling/skill.md` |
| Implement repository (Drizzle+SQLite) | `.agents/skills/repository-implementation/skill.md` |
| Implement use case | `.agents/skills/use-case-implementation/skill.md` |
| Implement NestJS controller + DTO | `.agents/skills/api-controller/skill.md` |
| Implement processing pipeline stage | `.agents/skills/pipeline-stage/skill.md` |
| Implement Gemini API integration | `.agents/skills/gemini-integration/skill.md` |
| Implement Next.js page/component | `.agents/skills/frontend-component/skill.md` |
| Write BDD test specs (Red phase) | `.agents/skills/bdd-test-writing/skill.md` |
| Implement batch of 3+ related items | `.agents/skills/batch-implementation/skill.md` |
| Setup project scaffolding | `.agents/skills/project-scaffold/skill.md` |
| **Before reporting ANY task done** | **`.agents/skills/quality-self-check/skill.md`** |

## Workflow Router

| Multi-step task | Workflow |
|---|---|
| Domain entity: spec → entity → value objects → tests | `.agents/workflows/implement-domain.md` |
| Use case: spec → test → implement → integration test | `.agents/workflows/implement-use-case.md` |
| API endpoint: spec → controller → dto → test → OpenAPI | `.agents/workflows/implement-api.md` |
| Frontend page: layout → components → API integration → SSE | `.agents/workflows/implement-page.md` |
| Processing stage: spec → service → test → pipeline wire | `.agents/workflows/implement-pipeline-stage.md` |
| Quality gate: tsc → jest → lint → build | `.agents/workflows/quality-gate-pipeline.md` |
| Session handoff: read → work → update | `.agents/workflows/session-handoff.md` |

---

## Hard Rules (no exceptions)

1. **No implementation without tests first** — write spec (RED), then code (GREEN), then refactor
2. No `any` types — always explicit TypeScript types
3. No `console.log` in production code
4. No NestJS/infrastructure imports in `domain/` layer — EVER (even `import type`)
5. No business logic in controllers — controllers are thin, delegate to use cases
6. No raw SQL in domain/application layers — use repository interfaces
7. No hardcoded config — use ConfigService or `config.env`
8. No skipping tests — domain + integration tests required per feature
9. **No completion claims without fresh verification** — run `npx tsc --noEmit` then `npx jest --bail` (from `packages/backend/`) OR `npm test` (from monorepo root) BEFORE saying "done". ⚠️ NEVER run `npx jest` from monorepo root (no jest config there)
10. **Debugging: root cause first** — 3 failed fixes → question architecture
11. **Props interfaces live in component files** (frontend) — API client generated from OpenAPI
12. **Server Components by default** — Client only for: file upload, real-time progress, interactive editors
13. Every public method has JSDoc with `@param` and `@returns`
14. `import type` for type-only imports
15. Conventional commits: `test: add specs for [X]` → `feat: implement [X]` → `refactor: clean up [X]`
16. **No implementation without action guide** — check `tasks/action-guides/s{NN}-*.md` BEFORE any code. If no guide exists → STOP → create one first using `.agents/workflows/create-action-guide.md`
17. **Always update `tasks/progress.md`** at session end — mark completed steps ✅, partial steps 🔄. This was missed in Session 3.
18. **Translate bash commands to PowerShell** — all config docs use bash syntax. Agent must adapt: separate `&&` into individual commands, use `grep_search` tool instead of `grep -r | wc -l`

---

## Session Dispatch (when receiving "do session N.X" or "do next session")

> **Follow this protocol EXACTLY.**

```
1. Read `.context/session-handoff.md` → current state
2. Read `.context/agent-notes.md` → learned rules + progress
3. Read `tasks/08-master-plan.md` → find current phase step

4. PRE-IMPLEMENTATION GATE (MANDATORY — DO NOT SKIP):
   Check: does tasks/action-guides/s{NN}-*.md exist for this session?
   ├── YES → Read it. Verify pre-flight checklist passes.
   └── NO → STOP. Do NOT write any implementation code.
             a. Read .agents/workflows/create-action-guide.md
             b. Follow ALL steps to create the action guide
             c. Save to tasks/action-guides/s{NN}-{feature-name}.md
             d. Present action guide to user for review
             e. ONLY THEN proceed to step 5

5. From action guide (or freshly created guide):
   - PREREQS → verify all are met before starting
   - MANDATORY_SKILLS → read EACH listed skill
   - WORKFLOWS → read EACH listed workflow
   - QUALITY GATE → know EXACTLY what to verify before claiming done

6. Execute tasks in order:
   - RED phase: write all test files, verify they FAIL
   - GREEN phase: implement code, verify tests PASS
   - REFACTOR: clean up, verify tests still PASS
7. Run QUALITY GATE commands
8. Update `.context/session-handoff.md`:
   - "What's Next" → copy NEXT session from master plan (VERBATIM)
   - "Action guide" → path to next session's action guide (create if not exists)
   - All counters updated
9. Update `.context/agent-notes.md`:
   - Progress section: update ALL counters
   - Learned Rules: add any new gotchas
10. Create action guide for NEXT session (if not already exists)
    - Follow .agents/workflows/create-action-guide.md
11. Commit with conventional format
```

---

## Project Architecture (Layer Map)

```
packages/backend/src/
  domain/          → Pure business logic. ZERO framework imports.
    {context}/
      *.entity.ts
      *.value-objects.ts
      *.repository.ts    (interface only)
      *.service.ts       (domain services)
      *.events.ts

  application/     → Use cases. Orchestrate domain + infrastructure.
    {context}/
      *.use-case.ts

  infrastructure/  → Framework, DB, external APIs.
    database/
      repositories/    (concrete implementations of domain interfaces)
      schema.ts        (Drizzle table definitions)
    ai/                (Gemini client)
    queue/             (Job queue)
    external-api/      (Viettel product client)
    config/

  interface/       → HTTP controllers, SSE, DTOs.
    http/
    sse/
    dto/

packages/frontend/src/
  app/             → Next.js App Router pages
  components/      → React components (props-only, no API imports)
  hooks/           → Custom hooks (useSSE, useBatchProgress)
  lib/             → API client (generated from OpenAPI), utilities
  stores/          → Zustand stores (UI state only)

packages/shared/src/
  domain/          → Shared types, value objects
  api/generated/   → OpenAPI generated client
  constants/       → Shared constants
```

### Layer Boundary Rules

```
domain/          → imports from: NOTHING external (only shared/domain/)
application/     → imports from: domain/, infrastructure/ (via DI)
infrastructure/  → imports from: domain/ (implements interfaces), @nestjs/*
interface/       → imports from: application/ (use cases), dto/

NEVER: domain/ → @nestjs/*
NEVER: domain/ → infrastructure/
NEVER: interface/ → domain/ (skip application layer)
NEVER: components/ → lib/api/ (use hooks or server actions)
```

---

## Essential Patterns

### Domain Entity Pattern
```typescript
// domain/invoice/invoice.entity.ts
export class Invoice {
  constructor(private readonly props: InvoiceProps) {
    this.validate();  // Always validate on construction
  }
  // Getters expose data, methods mutate state
  // No @nestjs decorators, no DB concepts
}
```

### Repository Pattern
```typescript
// domain/invoice/invoice.repository.ts (INTERFACE)
export interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}

// infrastructure/database/repositories/invoice.repository.impl.ts (IMPLEMENTATION)
@Injectable()
export class InvoiceRepository implements IInvoiceRepository {
  constructor(@Inject('DB') private db: DrizzleDB) {}
  // Drizzle queries here
}
```

### Use Case Pattern
```typescript
// application/processing/process-invoice.use-case.ts
@Injectable()
export class ProcessInvoiceUseCase {
  constructor(
    @Inject('IInvoiceRepository') private invoiceRepo: IInvoiceRepository,
    private ocrService: OcrService,
  ) {}
  async execute(invoiceId: string): Promise<ProcessingResult> { ... }
}
```

---

## Quality Self-Check (BEFORE saying "done")

```
□ tsc --noEmit passes (from packages/backend/ — or npm run typecheck from root)
□ jest --bail passes (from packages/backend/ — or npm test from root)
   ⚠️ NEVER npx jest from monorepo root
□ Domain layer: grep_search "@nestjs" in packages/backend/src/domain/ → 0 hits
□ No console.log: grep_search "console.log" in packages/backend/src/ (exclude spec) → 0
□ No any: grep_search ": any" in packages/backend/src/domain/ → 0
□ Every new file has at least 1 test
□ Session handoff updated
□ Agent notes updated
□ tasks/progress.md updated ← DO NOT SKIP
□ Conventional commit message used
```

---

## Anti-Defer Rules (ENFORCED)

❌ **FORBIDDEN patterns**:
- Logging "TODO: add tests later" + marking session DONE
- Skipping RED phase "because it's simple"
- Claiming PARTIAL but incrementing progress counters
- Inventing sessions not in the master plan
- "Tests pass" without fresh `jest --bail` output in THIS conversation
- Putting business logic in a controller "temporarily"

✅ **REQUIRED patterns**:
- Tests written FIRST, verified FAILING, then implement
- Fresh verification evidence before every completion claim
- PARTIAL status if any quality gate fails
- "Progress" counters increment ONLY when tests are green

---

## Key References

| Resource | Path |
|---|---|
| Business Spec | `tasks/01-business-spec.md` |
| Database Design | `tasks/04-database-design.md` |
| Low-Level Design | `tasks/06-low-level-design.md` |
| Master Plan | `tasks/08-master-plan.md` |
| Agent Notes | `.context/agent-notes.md` |
| Session Handoff | `.context/session-handoff.md` |
| Progress | `tasks/progress.md` |
