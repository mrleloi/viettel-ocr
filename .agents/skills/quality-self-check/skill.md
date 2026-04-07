---
name: Quality Self-Check
description: Post-task quality checklist. MUST run before reporting any task complete.
context-load: always
---

# Quality Self-Check Skill

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
```bash
# Backend
cd packages/backend && npx tsc --noEmit   # 0 errors

# Frontend (if modified)
cd packages/frontend && npx tsc --noEmit  # 0 errors
```

### 2. Tests
```bash
# All tests
npm test -- --bail

# Specific module (during development)
npm test -- --testPathPattern="invoice" --bail
```

### 3. Architecture Compliance
```bash
# Domain layer purity — MUST return 0 results
grep -r "@nestjs" packages/backend/src/domain/ || echo "CLEAN"
grep -r "import.*from.*infrastructure" packages/backend/src/domain/ || echo "CLEAN"

# No any in domain
grep -r ": any" packages/backend/src/domain/ || echo "CLEAN"

# No console.log in production
grep -rn "console.log" packages/backend/src/ --include="*.ts" | grep -v ".spec.ts" | grep -v ".test.ts" || echo "CLEAN"
```

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
- Fresh `tsc --noEmit && jest --bail` output before every "done" claim
- PARTIAL if any gate fails — with explicit failure list
- Progress counters increment ONLY when ALL gates pass
