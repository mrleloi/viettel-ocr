---
description: Create an execution plan for a phase or set of sessions. Breaks high-level master plan into actionable sessions with full context injection.
---

# Workflow: Create Plan

## When to Use

- Starting a new phase
- Master plan session descriptions are too high-level
- Need to break a large step into multiple sessions
- Handing off work to another agent who needs structure

## Steps

### 1. Gather Context
```
Read: tasks/08-master-plan.md → find phase/steps to plan
Read: tasks/01-business-spec.md → features involved
Read: tasks/06-low-level-design.md → module structure, file paths
Read: tasks/04-database-design.md → tables involved
Read: .context/session-handoff.md → current state
Read: .context/agent-notes.md → learned rules
Read: tasks/progress.md → what's done
```

### 2. Read Planning Skill
```
Read: .agents/skills/plan-creator/skill.md
Read: .agents/skills/skill-mapping/skill.md
```

### 3. Determine Session Boundaries
```
For each step in the master plan:
  1. List all files to create
  2. Estimate complexity per file
  3. Group by bounded context and layer
  4. Check dependencies between files
  5. Split into sessions (~60 tool calls max each)
  6. Assign skills and workflows per session
```

### 4. Write Plan
```
Follow template in .agents/skills/plan-creator/skill.md
For each session:
  - List prerequisites
  - List mandatory skills (use skill-mapping)
  - List mandatory workflows
  - Create task table with file paths
  - Define quality gate
  - Define handoff notes
```

### 5. Save Plan
```
Save to: tasks/plans/{phase}-execution-plan.md
```

### 6. Create Action Guides for First Sessions
```
Read: .agents/skills/action-guide-creator/skill.md
Run: .agents/workflows/create-action-guide.md (for session 1)
Run: .agents/workflows/create-action-guide.md (for session 2, optional)
```

### 7. Update Tracking
```
Update: tasks/progress.md → add session rows
Update: .context/session-handoff.md → "What's Next" = first session from plan
```

## Quality Checklist

- [ ] Every session has mandatory skills listed
- [ ] Every session has quality gate commands
- [ ] Every session has prerequisite check
- [ ] Sessions are properly ordered (dependencies respected)
- [ ] No session exceeds ~60 tool calls
- [ ] Action guide created for at least the first session
- [ ] Progress tracker updated
- [ ] Session handoff updated
