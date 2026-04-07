# Shared Agent Configuration

> Both Claude Code (Architect) and Antigravity (Developer) MUST read this file.
> Agent-specific configs: `CLAUDE.md` (Architect) | `.gemini/AGENTS.md` (Developer)

---

## Skill Router (Universal)

> Any agent performing a task MUST read the corresponding skill BEFORE starting.

### Planning & Authoring Skills

| Task type | Skill | Who typically uses |
|---|---|---|
| Create execution plan for a phase | `.agents/skills/plan-creator/skill.md` | Architect (primary), Developer (can) |
| Create action guide for a session | `.agents/skills/action-guide-creator/skill.md` | Architect (primary), Developer (can) |
| Map skills/workflows to a session | `.agents/skills/skill-mapping/skill.md` | Both |

### Implementation Skills

| Task type | Skill | Who typically uses |
|---|---|---|
| Implement domain entity/value object | `.agents/skills/domain-modeling/skill.md` | Developer |
| Write BDD test specs (Red phase) | `.agents/skills/bdd-test-writing/skill.md` | Both |
| Implement repository (Drizzle+SQLite) | `.agents/skills/repository-implementation/skill.md` | Developer |
| Implement use case | `.agents/skills/use-case-implementation/skill.md` | Developer |
| Implement NestJS controller + DTO | `.agents/skills/api-controller/skill.md` | Developer |
| Implement processing pipeline stage | `.agents/skills/pipeline-stage/skill.md` | Developer |
| Implement Gemini API integration | `.agents/skills/gemini-integration/skill.md` | Developer |
| Implement Next.js page/component | `.agents/skills/frontend-component/skill.md` | Developer |
| Implement batch of 3+ items | `.agents/skills/batch-implementation/skill.md` | Developer |
| Setup project scaffolding | `.agents/skills/project-scaffold/skill.md` | Developer |

### Quality & Operations Skills

| Task type | Skill | Who typically uses |
|---|---|---|
| **Before reporting ANY task done** | **`.agents/skills/quality-self-check/skill.md`** | **Both (MANDATORY)** |
| Session start/end protocol | `.agents/skills/session-handoff/skill.md` | Both |

## Workflow Router (Universal)

| Multi-step task | Workflow | Who |
|---|---|---|
| Plan a phase → break into sessions | `.agents/workflows/create-plan.md` | Both |
| Create action guide → inject context | `.agents/workflows/create-action-guide.md` | Both |
| Domain entity: spec → tests → implement | `.agents/workflows/implement-domain.md` | Developer |
| Use case: spec → test → implement | `.agents/workflows/implement-use-case.md` | Developer |
| API endpoint: spec → controller → test | `.agents/workflows/implement-api.md` | Developer |
| Frontend page: layout → components → API | `.agents/workflows/implement-page.md` | Developer |
| Processing stage: spec → service → test | `.agents/workflows/implement-pipeline-stage.md` | Developer |
| Quality gate: tsc → jest → drift-check | `.agents/workflows/quality-gate-pipeline.md` | Both |
| Session lifecycle: read → work → update | `.agents/workflows/session-handoff.md` | Both |

## Command Router (Universal)

| Command | Purpose | Who |
|---|---|---|
| `/session-start` | Begin work session | Both |
| `/session-end` | End work session | Both |
| `/plan` | Create execution plan | Both |
| `/action-guide` | Generate implementation guide | Both |
| `/spec` | Write BDD test specification | Both |
| `/verify` | Run full quality gate | Both |
| `/drift-check` | Detect architecture violations | Both |

---

## Pre-Implementation Gate (AUTO-CHECK)

> **Before ANY implementation task, the agent MUST verify an action guide exists.**

```
BEFORE starting implementation:
  1. Check: does tasks/action-guides/{session}-{feature}.md exist?
     ├── YES → Read it, then implement
     └── NO →
         Is this a planning/spec session (not implementation)?
         ├── YES → Proceed (action guides are for implementation only)
         └── NO →
             ⚠️ STOP. Create action guide FIRST.
             Read: .agents/skills/action-guide-creator/skill.md
             Run:  .agents/workflows/create-action-guide.md
             THEN: proceed with implementation
```

This gate ensures no implementation happens without proper context injection.

---

## Context Injection Rules

Every action guide and plan MUST include:

1. **Business context**: reference to specific section in `tasks/01-business-spec.md`
2. **Design context**: reference to relevant design doc sections
3. **Skill references**: which `.agents/skills/*/skill.md` to read before implementing
4. **Workflow reference**: which `.agents/workflows/*.md` to follow
5. **Prerequisite check**: what must exist/pass before this work starts
6. **Quality gate**: exactly what to verify before claiming done
7. **Handoff notes**: what the next session needs to know

---

## Source of Truth Hierarchy

| Priority | Source | Use For |
|---|---|---|
| **1st** | `tasks/01-business-spec.md` | What to build |
| **2nd** | `tasks/03-*` through `tasks/07-*` | How to build it |
| **3rd** | `tasks/08-master-plan.md` | In what order |
| **4th** | `tasks/action-guides/*.md` | Step-by-step per session |
| **5th** | `.context/session-handoff.md` | Current state |

If sources conflict, higher priority wins.
