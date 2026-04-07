---
description: Create a detailed action guide for a specific session. Ensures proper context injection so any agent can execute the session successfully.
---

# Workflow: Create Action Guide

## When to Use

- Before ANY implementation session (mandatory — see Pre-Implementation Gate)
- When handing off work to another agent
- When a session is complex enough to benefit from step-by-step guide
- When the auto-check in `.agents/SHARED.md` detects no guide exists

## Steps

### 1. Identify Session
```
Read: tasks/08-master-plan.md → find session
  OR: tasks/plans/{phase}-execution-plan.md → find session (if detailed plan exists)
Note: session ID, title, phase step, scope
```

### 2. Gather Context
```
Read: tasks/01-business-spec.md → relevant feature section(s)
Read: tasks/04-database-design.md → tables involved
Read: tasks/05-data-flow-design.md → flow this session's code participates in
Read: tasks/06-low-level-design.md → exact file paths, module structure
Read: .context/session-handoff.md → current state, what exists
Read: .context/agent-notes.md → learned rules that apply
```

### 3. Determine Skills & Workflows
```
Read: .agents/skills/skill-mapping/skill.md
Apply decision tree to each task in the session
List: mandatory skills (ordered by read priority)
List: primary workflow to follow
```

### 4. Extract Types & Rules
```
From design docs and business spec, extract:
  - TypeScript interfaces/types the agent will need
  - Business rules as explicit table: rule → logic → edge case
  - Validation rules from DB design
  - Cross-references between entities
```

### 5. Write Guide
```
Read: .agents/skills/action-guide-creator/skill.md → follow template exactly
Write: tasks/action-guides/{session-id}-{feature-name}.md

CRITICAL: Include ALL sections from template. No shortcuts.
```

### 6. Quality Check Guide
```
Run mental "fresh agent test":
  - Could an agent with ZERO context execute this?
  - Are all file paths exact (not approximate)?
  - Are all skills explicitly listed (not "read relevant skills")?
  - Is the quality gate copy-pasteable?
  - Are acceptance criteria binary (pass/fail)?

If any answer is NO → fix the guide before publishing.
```

### 7. Update Handoff
```
Update: .context/session-handoff.md
  - "What's Next" references the session this guide is for
  - Note: "Action guide ready at tasks/action-guides/{filename}"
```

## Guide Freshness

Action guides can become stale if:
- Previous session changed architecture
- New learned rules in agent-notes
- Design docs were updated

**Before executing a guide created >1 session ago**, verify:
1. `.context/session-handoff.md` still matches guide's prerequisites
2. Files listed in guide's prerequisite section actually exist
3. No new learned rules in agent-notes that contradict guide

If stale → update guide before executing.

## Quality Checklist

- [ ] Pre-flight checklist included (build/test verification)
- [ ] Business context with spec reference
- [ ] All file paths are exact from project root
- [ ] At least 2 skills referenced (+ quality-self-check always)
- [ ] At least 1 workflow referenced
- [ ] Key TypeScript types spelled out
- [ ] Business rules as table (not prose)
- [ ] Quality gate with copy-paste commands
- [ ] Acceptance criteria are binary pass/fail
- [ ] Handoff section with next session ID
- [ ] Passes "fresh agent test"
