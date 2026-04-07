---
description: Run quality gates before commit or session end. Multi-tier verification.
---

# Workflow: Quality Gate Pipeline

## Gate 1 — Deterministic (per commit)

```bash
# Backend
cd packages/backend
npx tsc --noEmit
npx jest --bail

# Frontend (if modified)
cd packages/frontend
npx tsc --noEmit

# Shared
cd packages/shared
npx tsc --noEmit
```

**Blocks**: session completion if any command fails.

## Gate 2 — Architecture Compliance (per session)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Domain purity | `grep -r "@nestjs" packages/backend/src/domain/` | 0 results |
| No any in domain | `grep -r ": any" packages/backend/src/domain/` | 0 results |
| No console.log | `grep -rn "console.log" packages/backend/src/ --include="*.ts" \| grep -v spec \| grep -v test` | 0 results |
| Repos in right place | Interfaces in domain/, implementations in infrastructure/ | Manual check |
| Use cases tested | Every use case file has corresponding .spec.ts | Manual check |

## Gate 3 — E2E (per phase completion)

Full flow test: Upload PDF → OCR → Extract → Validate → Review → Export
- Start server (`npm start`)
- Upload sample invoice PDF
- Verify extraction result
- Approve in review
- Export CSV

## When to Run

| Event | Gates |
|-------|-------|
| Every commit | Gate 1 |
| Every session end | Gate 1 + Gate 2 |
| Every phase completion | Gate 1 + Gate 2 + Gate 3 |

## Post-Gate: Update Tracking

After ALL gates pass:
1. `.context/session-handoff.md` — Build/Tests status
2. `.context/agent-notes.md` — Progress counts
3. `tasks/progress.md` — Phase step status
