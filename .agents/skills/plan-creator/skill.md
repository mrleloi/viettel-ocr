---
name: Plan Creator
description: How to create execution plans that break a phase into sessions with proper context injection. Use when planning work for self or another agent.
context-load: once
---

# Skill: Plan Creator

## When to Use

- Starting a new phase (Phase 1, 2, 3...)
- Breaking a large task into multiple sessions
- When asked to "plan", "break down", "create execution plan"
- When master plan's session descriptions are too high-level for execution

## Input Required

Before creating a plan, gather:

1. **Scope**: What phase step(s) from `tasks/08-master-plan.md`?
2. **Design docs**: Read relevant sections of design docs (HLD, LLD, DB, data-flow)
3. **Current state**: Read `.context/session-handoff.md` for what exists already
4. **Constraints**: Time budget, complexity, dependencies

## Plan Structure

```markdown
# Execution Plan: {Phase/Step Name}

> Created: {date} | Agent: {name}
> Scope: Phase {N}, Steps {X.Y} through {X.Z}
> Estimated sessions: {N}

## Prerequisites

- [ ] {What must exist before this plan starts}
- [ ] {Previous phase complete?}
- [ ] {Dependencies resolved?}

## Session {N.1}: {Descriptive Title}

### Metadata
- **Agent**: {Architect | Developer | Either}
- **Phase Step**: {from master plan}
- **Estimated files**: {count}
- **Estimated tool calls**: {count, warn if >60}

### Prerequisites
- [ ] {What must be done before this session}

### Mandatory Skills
- `.agents/skills/{skill1}/skill.md`
- `.agents/skills/{skill2}/skill.md`

### Mandatory Workflows
- `.agents/workflows/{workflow}.md`

### Tasks

| # | Task | Type | Output File | Test File |
|---|------|------|-------------|-----------|
| 1 | {description} | RED | — | `path/to/test.spec.ts` |
| 2 | {description} | GREEN | `path/to/file.ts` | — |
| 3 | {description} | REFACTOR | `path/to/file.ts` | — |

### Quality Gate
```bash
{exact commands to run before claiming done}
```

### Produces (for next session)
- {List of artifacts this session creates}
- {Action guides if Architect session}

### Handoff Notes
- Next session: "{Session N.2: Title}" (VERBATIM)
- Context needed: {what next agent needs to know}

---

## Session {N.2}: {Title}
{same structure...}
```

## Key Principles

### 1. Session Sizing
- Target: 2-4 hours of work per session
- Max ~60 tool calls per session (warn if >60, propose split)
- Group related items (same bounded context, same layer)
- Don't mix RED and GREEN across different features in one session

### 2. Dependency Ordering
```
Value Objects → Entities → Repository Interfaces → Domain Services
  → Repository Implementations → Use Cases → Controllers → Frontend
```

### 3. Skill Injection
Every session MUST list:
- `MANDATORY_SKILLS`: skills the agent MUST read before starting
- `MANDATORY_WORKFLOWS`: workflows to follow
- At minimum: `quality-self-check` + `session-handoff` are always mandatory

### 4. Task Granularity
Each task row should be:
- One file creation OR one logical unit of work
- Tagged with phase: RED (test), GREEN (implement), REFACTOR (clean)
- Include both output file path AND test file path

### 5. Quality Gate Per Session
Every session ends with explicit verification commands:
```bash
# Minimum
tsc --noEmit && jest --bail

# If architecture work
bash .agents/scripts/drift-check.sh

# If frontend work
cd packages/frontend && npx next build
```

### 6. Cross-Session Dependencies
If Session 3 depends on Session 2's output:
- Session 3's Prerequisites section MUST list what Session 2 produces
- If Session 2 is PARTIAL, Session 3 MUST handle missing items

## Anti-Patterns

❌ "Session 5: Implement remaining features" — too vague
❌ Session with >10 new files and no skill references — will fail
❌ Session that mixes backend domain + frontend page — too scattered
❌ Plan without quality gates — completion will be unverifiable
❌ Session without mandatory skills listed — agent won't know patterns

## Output

Save plan to: `tasks/plans/{phase}-execution-plan.md`
Example: `tasks/plans/phase1-execution-plan.md`

## After Creating Plan

1. Update `tasks/progress.md` with new session rows
2. Update `.context/session-handoff.md` → "What's Next" references first session
3. If Architect: create action guides for first 1-2 Developer sessions
