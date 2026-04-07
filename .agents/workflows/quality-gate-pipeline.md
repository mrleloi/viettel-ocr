---
description: Run quality gates before commit or session end. Multi-tier verification.
---

# Workflow: Quality Gate Pipeline

> ⚠️ **OS Note**: This project runs on **Windows + PowerShell**. Bash syntax (`&&`, `grep -r`, `wc -l`) does NOT work.
> Use PowerShell equivalents or the agent's built-in tools (grep_search, run_command).

## Gate 1 — Deterministic (per commit)

**From monorepo root** (`invoice-tool/`):
```powershell
# Backend typecheck (delegates via workspace)
npm run typecheck

# Backend tests (delegates via workspace)
npm test
```

**Or from backend directory** (`packages/backend/`):
```powershell
npx tsc --noEmit
npx jest --bail
```

> ⚠️ **NEVER run `npx jest` from monorepo root** — no Jest config there, all suites fail.

**Frontend** (if modified, from `packages/frontend/`):
```powershell
npx tsc --noEmit
```

**Blocks**: session completion if any command fails.

## Gate 2 — Architecture Compliance (per session)

| Check | How to verify | Pass Criteria |
|-------|--------------|---------------|
| Domain purity (no @nestjs) | Use `grep_search` tool: query `@nestjs` in `domain/` | 0 results |
| Domain purity (no drizzle) | Use `grep_search` tool: query `drizzle-orm` in `domain/` | 0 results |
| No `any` in domain | Use `grep_search` tool: query `: any` in `domain/` | 0 results |
| No infra imports in domain | Use `grep_search` tool: query `from.*infrastructure` (regex) in `domain/` | 0 results |
| No console.log in prod | Use `grep_search` tool: query `console.log` in `src/` excluding `spec.ts` | 0 results |
| Repos in right place | Interfaces in `domain/`, implementations in `infrastructure/` | Manual check |
| Use cases tested | Every use case file has corresponding `.spec.ts` | Manual check |

**PowerShell alternative** (if not using agent tools):
```powershell
# From project root (invoice-tool/)
Select-String -Path "packages\backend\src\domain\**\*.ts" -Pattern "@nestjs" -SimpleMatch
Select-String -Path "packages\backend\src\domain\**\*.ts" -Pattern ": any" -SimpleMatch
```

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
3. **`tasks/progress.md`** — Phase step status ← **DO NOT SKIP** (was missed in Session 3)
