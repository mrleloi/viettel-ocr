---
name: Action Guide Creator
description: How to create detailed, context-rich action guides that enable any agent to execute a session perfectly. CRITICAL skill — action guides are the primary vehicle for knowledge transfer between sessions and agents.
context-load: once
---

# Skill: Action Guide Creator

## Why Action Guides Matter

An action guide is the **single document an agent reads to execute a session**. It must contain:
- ALL context needed (no "go read 5 other docs first")
- ALL file paths (exact, not approximate)
- ALL skill/workflow references (so agent loads right patterns)
- ALL acceptance criteria (so agent knows when done)
- ENOUGH detail that an agent with ZERO prior context can execute successfully

**The test**: If you give this action guide to a fresh agent instance with no conversation history, can it execute the session correctly? If not, the guide is insufficient.

## When to Create

- **Always** before a Developer implementation session
- **Always** before handing off work to another agent
- **Optionally** for your own future sessions (recommended for complex work)
- **Auto-check**: implementation sessions without an action guide should STOP and create one first (see `.agents/SHARED.md` Pre-Implementation Gate)

## Creation Process

### Step 1: Gather Context

```
1. Read: tasks/08-master-plan.md → find the session being planned
2. Read: tasks/01-business-spec.md → relevant feature(s) for this session
3. Read: tasks/04-database-design.md → relevant tables
4. Read: tasks/06-low-level-design.md → relevant module structure
5. Read: tasks/05-data-flow-design.md → relevant flow (if processing-related)
6. Read: .context/session-handoff.md → current state, what exists
7. Read: .context/agent-notes.md → learned rules, gotchas to avoid
8. Read: tasks/progress.md → what's done, what's pending
```

### Step 2: Determine Required Skills & Workflows

Use `.agents/skills/skill-mapping/skill.md` to determine which skills apply.

```
For each task in the session:
  What type of work?
  ├── Domain entity → domain-modeling + bdd-test-writing
  ├── Domain service → domain-modeling + bdd-test-writing + pipeline-stage (if processing)
  ├── Repository impl → repository-implementation
  ├── Use case → use-case-implementation + bdd-test-writing
  ├── Controller → api-controller
  ├── Frontend → frontend-component
  ├── AI integration → gemini-integration
  └── Multiple items → batch-implementation (in addition to above)

  What workflow applies?
  ├── Domain work → implement-domain
  ├── Use case → implement-use-case
  ├── API → implement-api
  ├── Frontend → implement-page
  ├── Pipeline stage → implement-pipeline-stage
  └── Always → quality-gate-pipeline + session-handoff
```

### Step 3: Write the Guide

Use the template below. **Every section is mandatory** — do not skip any.

## Action Guide Template

````markdown
# Action Guide: Session {N} — {Title}

> Created: {date} | Created by: {agent name}
> Phase Step: {from master plan}
> Target Agent: {Architect | Developer | Either}

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: {session N-1 title} → check `.context/session-handoff.md`
- [ ] Build passing: `cd packages/backend && npx tsc --noEmit` → 0 errors
- [ ] Tests passing: `npm test -- --bail` → all green
- [ ] Required files exist: {list files that must exist from previous sessions}

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
{2-3 sentence summary from tasks/01-business-spec.md, with section reference}

Reference: `tasks/01-business-spec.md` § {Feature number, e.g., "F03 — Classification & Fingerprinting"}

### Architecture Context
{How this session's work fits into the bounded context and layer map}

Reference: `tasks/06-low-level-design.md` § {section}

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| {table_name} | {why this table matters} |

Reference: `tasks/04-database-design.md` § {section}

### Data Flow
{Where this session's code sits in the overall data flow}

Reference: `tasks/05-data-flow-design.md` § {flow name}

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/{primary-skill}/skill.md` — {why}
2. `.agents/skills/{secondary-skill}/skill.md` — {why}
3. `.agents/skills/quality-self-check/skill.md` — always

### Workflows (follow this one)
- `.agents/workflows/{workflow}.md` — {describes the step-by-step}

### Relevant Learned Rules
{Copy specific rules from .context/agent-notes.md that apply to this session}
- {rule 1}
- {rule 2}

---

## 3. Tasks (Ordered)

### Task 1: {Description}

**Type**: RED (test) | GREEN (implement) | REFACTOR
**File**: `packages/backend/src/domain/{context}/{file}.ts`
**Test**: `packages/backend/src/domain/{context}/__tests__/{file}.spec.ts`

**What to do**:
{Detailed instructions — specific enough that agent doesn't need to guess}

**Key types**:
```typescript
{TypeScript interfaces, enums, or types needed}
```

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| {name} | {logic} | {what to test} |

**Verify**: `jest --testPathPattern="{pattern}" --bail`

---

### Task 2: {Description}
{same structure...}

---

### Task N: Register & Wire
{If applicable: NestJS module registration, barrel exports, etc.}

---

## 4. Quality Gate

Run ALL of these before claiming done:

```bash
# Build
cd packages/backend && npx tsc --noEmit

# Tests
npm test -- --bail

# Architecture (if domain work)
grep -r "@nestjs" packages/backend/src/domain/ | wc -l  # expect 0
grep -r ": any" packages/backend/src/domain/ | wc -l    # expect 0

# Drift check (if significant changes)
bash .agents/scripts/drift-check.sh
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] {Specific, verifiable criterion 1}
- [ ] {Specific, verifiable criterion 2}
- [ ] {Specific, verifiable criterion 3}
- [ ] All tests pass (fresh `jest --bail` output)
- [ ] `tsc --noEmit` passes
- [ ] No architecture violations (drift-check clean)
- [ ] Session handoff updated
- [ ] Agent notes updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: {what was accomplished}
   - Found: {surprises or issues}
   - What's Next: "{Session N+1: Title}" (from master plan)

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Any new learned rules

3. Commit: `{conventional commit message}`

**Next session depends on**: {list what next session needs from this one}
````

## Quality Checks for Action Guides

Before finalizing an action guide, verify:

- [ ] **Fresh agent test**: Could an agent with zero context execute this? No assumed knowledge?
- [ ] **All file paths are exact**: No "somewhere in domain/", always full path from project root
- [ ] **Skills referenced**: At least 1 skill + quality-self-check listed
- [ ] **Workflow referenced**: At least 1 workflow listed
- [ ] **Business context included**: Not just "implement X" but WHY and WHAT behavior
- [ ] **Types defined**: Key TypeScript interfaces/types spelled out in the guide
- [ ] **Business rules as table**: Not buried in prose — explicit rule + logic + edge case
- [ ] **Quality gate is copy-pasteable**: Agent can run commands directly
- [ ] **Acceptance criteria are binary**: Each is clearly pass/fail, not subjective
- [ ] **Handoff section complete**: Next session clearly identified

## Anti-Patterns

❌ "Implement the invoice entity" — no types, no rules, no test cases
❌ "Follow the design doc" — doesn't inject specific context
❌ "Read all the skills" — doesn't say WHICH skills
❌ Missing pre-flight checklist — agent discovers broken build mid-session
❌ Missing quality gate — agent claims done without verification
❌ Acceptance criteria like "code works well" — subjective, unverifiable
❌ No handoff section — next session starts blind

## Output

Save to: `tasks/action-guides/{session-id}-{feature-name}.md`
Examples:
- `tasks/action-guides/s01-project-scaffold.md`
- `tasks/action-guides/s02-domain-entities.md`
- `tasks/action-guides/s03-fingerprint-validator.md`
