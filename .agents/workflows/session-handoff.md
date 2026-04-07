---
description: Complete session lifecycle — start, work, end. Use for every session.
---

# Workflow: Session Handoff

> ⚠️ **OS**: Windows + PowerShell. Bash `&&` syntax does NOT work. Run commands separately.

## Start Phase (5% of session)

```
1. Read .context/session-handoff.md
2. Read .context/agent-notes.md  (ESPECIALLY "OS & Shell" + "Correct Test/Build Commands")
3. Read tasks/progress.md
4. Identify current session from tasks/08-master-plan.md
5. PRE-IMPLEMENTATION GATE (mandatory — see below)
6. Read mandatory skills listed in action guide
7. State plan (2-4 items) before coding
```

### Pre-Implementation Gate (MANDATORY)

// turbo-all
```
CHECK: Does an action guide exist for this session?
  Look in: tasks/action-guides/s{NN}-*.md
  
  ├── YES → Read it. Verify pre-flight checklist passes.
  │
  └── NO → STOP. Do NOT write any code.
        1. Read .agents/workflows/create-action-guide.md
        2. Follow it to create the action guide
        3. Save to tasks/action-guides/s{NN}-{feature-name}.md
        4. THEN proceed to Work Phase using the guide you just created
```

**WHY**: Action guides inject ALL context (types, business rules, file paths, skills)
into a single document. Without one, the agent will miss context and produce
lower-quality output. This gate prevents that.

## Work Phase (80% of session)

```
For each item:
  1. RED:      Write tests → verify FAIL → commit
  2. GREEN:    Implement → verify PASS → commit
  3. REFACTOR: Clean up → verify still PASS → commit
  4. Run full test suite after each item:
     - From monorepo root: npm test
     - OR from packages/backend: npx jest --bail
     ⚠️ NEVER run `npx jest` from monorepo root (no jest config there)
```

## End Phase (15% of session)

```
1. Run quality gate:
   - From monorepo root: npm run typecheck; npm test
   - OR from packages/backend: npx tsc --noEmit; npx jest --bail
   ⚠️ Do NOT use bash && syntax on PowerShell
   
2. Run architecture checks (use grep_search tool or Select-String):
   - @nestjs in domain/ → 0 hits
   - drizzle-orm in domain/ → 0 hits
   - : any in domain/ → 0 hits

3. Update .context/session-handoff.md
   - Include: "Action guide for next session: tasks/action-guides/s{N+1}-*.md" (if created)
   - All counters updated

4. Update .context/agent-notes.md
   - Progress counts
   - Any new learned rules

5. ⚠️ Update tasks/progress.md ← DO NOT SKIP (was missed in Session 3)
   - Set completed steps to ✅ Done
   - Set partial steps to 🔄 In progress
   - Update session log

6. Create action guide for NEXT session (if not already exists)
   - Follow .agents/workflows/create-action-guide.md

7. Commit: "docs: session N handoff"

8. 🚀 Auto-start next session (LAST step — do this AFTER everything else):
   - Run: /end-session workflow
   - This will open a new Antigravity session and prompt "do next session"
```

## Cross-Agent Handoff

When Architect (Claude Code) hands off to Developer (Antigravity):
- Architect creates action guides in `tasks/action-guides/`
- Action guide lists: files to create, types, business rules, acceptance criteria
- Developer reads action guide BEFORE starting work

When Developer hands off to Architect:
- Developer updates session-handoff with: what done, what found, what's pending
- Architect verifies: run quality gate, check architecture compliance, review code
