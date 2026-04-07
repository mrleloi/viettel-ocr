---
name: Quality Self-Check
description: Post-task quality checklist. MUST run before reporting any task complete.
context-load: always
---

# Quality Self-Check Skill

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` / `grep -r` / `wc -l`. Use agent tools or separate commands.

## Verification Iron Law

> **NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

Before saying "done", "all tests pass", or "build succeeds" — you MUST have run the actual command
in THIS conversation and seen the output with your own eyes.

**The Gate Function** (apply before ANY completion claim):
1. **IDENTIFY**: What command proves this claim? (`tsc --noEmit`, `jest --bail`)
2. **RUN**: Execute the command (fresh, complete — not from memory)
3. **READ**: Check full output + exit code
4. **VERIFY**: Does output confirm the claim?
5. **ONLY THEN**: State the claim WITH evidence

❌ Red flags (STOP if you catch yourself):
- "Should pass now" / "Looks correct" / "Tests should work"
- Expressing satisfaction BEFORE running verification
- Trusting a previous run (re-run after EVERY change)
- "Just this once, I'll skip verification"

## Pre-Completion Checklist

### 1. Build & Types

**From `packages/backend/` directory:**
```powershell
npx tsc --noEmit   # 0 errors
```

**Or from monorepo root (`invoice-tool/`):**
```powershell
npm run typecheck  # delegates to backend
```

**Frontend** (if modified, from `packages/frontend/`):
```powershell
npx tsc --noEmit
```

### 2. Tests

**From `packages/backend/` directory:**
```powershell
npx jest --bail
# Specific module:
npx jest --testPathPattern="invoice" --bail
```

**Or from monorepo root:**
```powershell
npm test
```

> ⚠️ **NEVER** run `npx jest` from monorepo root — no Jest config there, all suites fail.

### 2.5 Backend Smoke Test (if backend changed)

> ⚠️ **WHY**: `tsc` and `jest` cannot detect missing NestJS module imports or unresolvable DI providers.
> Only starting the actual server exercises the full DI container.

```powershell
# From project root:
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"
```

**Must run when**: Any `*.module.ts`, `@Inject()` constructor, or database schema was changed.

**Common failures**:
| Error | Fix |
|-------|-----|
| `UnknownDependenciesException: can't resolve "IFoo"` | Import the module that provides `IFoo` into the consuming module |
| `Circular dependency between FooModule and BarModule` | Use `forwardRef(() => FooModule)` on BOTH sides |
| `SQLITE_ERROR: no such table` | Add `CREATE TABLE IF NOT EXISTS` to `connection.ts` `initializeTables()` |
| Primitive constructor params unresolvable | Add `@Optional() @Inject('TOKEN')` decorators |
### 3. Architecture Compliance

**Use the `grep_search` agent tool** (preferred — works on all OS):

| Check | grep_search query | Search path | Expect |
|-------|-------------------|-------------|--------|
| No @nestjs in domain | `@nestjs` | `packages/backend/src/domain` | 0 results |
| No drizzle in domain | `drizzle-orm` | `packages/backend/src/domain` | 0 results |
| No infra imports in domain | `from.*infrastructure` (regex) | `packages/backend/src/domain` | 0 results |
| No `any` in domain | `: any` | `packages/backend/src/domain` | 0 results |
| No console.log in prod | `console.log` | `packages/backend/src` (exclude `*.spec.ts`) | 0 results |

### 4. Code Quality
- [ ] No `any` types — use explicit interfaces
- [ ] No unused imports
- [ ] All files use `import type` for type-only imports
- [ ] Every public method has JSDoc
- [ ] Conventional commit message format
- [ ] No TODO without explanation

### 5. Domain Layer Rules
- [ ] Entities validate on construction
- [ ] Value objects are immutable
- [ ] Repository interfaces in domain/ (not infrastructure/)
- [ ] Domain services have no framework dependencies
- [ ] Domain events are plain objects (no decorators)

### 6. Test Quality
- [ ] Each domain service: happy path + ≥2 edge cases + ≥1 error case
- [ ] Each use case: ≥1 integration test
- [ ] Each API endpoint: ≥1 API test
- [ ] Tests use factory functions for fixtures (not shared mutable objects)
- [ ] RED phase committed separately from GREEN phase

### 7. Session Hygiene
- [ ] `.context/session-handoff.md` updated
- [ ] `.context/agent-notes.md` updated (progress + learned rules)
- [ ] `tasks/progress.md` updated
- [ ] Commit message follows conventional format

## Anti-Defer Rules (ENFORCED — violations are session failures)

❌ **FORBIDDEN patterns**:
- Logging "TODO: tests later" + marking DONE → **VIOLATION**
- Inventing sessions not in master plan → **VIOLATION**
- Skipping RED phase for "simple" features → **VIOLATION**
- Claiming PARTIAL but incrementing progress counters → **VIOLATION**
- Putting domain logic in controller "temporarily" → **VIOLATION**
- "Tests pass" from memory without fresh run → **VIOLATION**

✅ **REQUIRED patterns**:
- Tests FIRST → verify FAIL → implement → verify PASS
- Fresh `npx tsc --noEmit; npx jest --bail` from `packages/backend/` (or `npm test` from root) before every "done" claim
- PARTIAL if any gate fails — with explicit failure list
- Progress counters increment ONLY when ALL gates pass
