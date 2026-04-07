---
description: Complete session lifecycle — start, work, end. Use for every session.
---

# Workflow: Session Handoff

## Start Phase (5% of session)

```
1. Read .context/session-handoff.md
2. Read .context/agent-notes.md
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
  
  ├── YES → Read it. Verify pre-flight checklist passes. Proceed to Work Phase.
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
  4. Run full test suite (jest --bail) after each item
```

## End Phase (15% of session)

```
1. Run quality gate (tsc --noEmit && jest --bail)
2. Run architecture checks (grep for violations)
3. Update .context/session-handoff.md
   - Include: "Action guide for next session: tasks/action-guides/s{N+1}-*.md" (if created)
4. Update .context/agent-notes.md
5. Update tasks/progress.md
6. Create action guide for NEXT session (if not already exists)
   - Follow .agents/workflows/create-action-guide.md
7. Commit: "docs: session N handoff"
```

## Cross-Agent Handoff

When Architect (Claude Code) hands off to Developer (Antigravity):
- Architect creates action guides in `tasks/action-guides/`
- Action guide lists: files to create, types, business rules, acceptance criteria
- Developer reads action guide BEFORE starting work

When Developer hands off to Architect:
- Developer updates session-handoff with: what done, what found, what's pending
- Architect verifies: run quality gate, check architecture compliance, review code
