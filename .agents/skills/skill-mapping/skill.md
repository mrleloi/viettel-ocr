---
name: Skill Mapping
description: How to determine which skills and workflows are needed for a given task or session. Use when creating plans or action guides.
context-load: once
---

# Skill: Skill Mapping

## When to Use

- Creating an execution plan (need to assign skills per session)
- Creating an action guide (need to list mandatory skills)
- Starting a session without an action guide (need to self-determine skills)

## Decision Tree

```
What layer am I working in?
│
├── DOMAIN (entities, VOs, services, repo interfaces)
│   ├── Creating entity?       → domain-modeling + bdd-test-writing
│   ├── Creating value object?  → domain-modeling + bdd-test-writing
│   ├── Creating domain service?→ domain-modeling + bdd-test-writing
│   │   ├── Pipeline stage?     → + pipeline-stage
│   │   ├── Fingerprint/match?  → + pipeline-stage
│   │   └── Fuzzy matching?     → + pipeline-stage
│   └── Creating repo interface?→ domain-modeling
│
├── INFRASTRUCTURE (DB repos, AI client, queue, file storage)
│   ├── DB repository impl?     → repository-implementation
│   ├── Gemini integration?     → gemini-integration
│   ├── Job queue?              → (no specific skill, follow LLD)
│   └── File storage?           → (no specific skill, follow LLD)
│
├── APPLICATION (use cases)
│   └── Any use case?           → use-case-implementation + bdd-test-writing
│
├── INTERFACE (controllers, DTOs, SSE)
│   └── Any controller?         → api-controller
│
├── FRONTEND (pages, components)
│   └── Any page/component?     → frontend-component
│
└── PROJECT SETUP
    └── Scaffolding?            → project-scaffold
```

## Workflow Selection

```
What is the overall task shape?
│
├── Single domain entity end-to-end    → implement-domain
├── Single use case end-to-end         → implement-use-case
├── Single API endpoint end-to-end     → implement-api
├── Single frontend page end-to-end    → implement-page
├── Single pipeline stage end-to-end   → implement-pipeline-stage
├── Planning / breaking down work      → create-plan
├── Creating guide for another agent   → create-action-guide
└── Any combination above              → compose: primary workflow + quality-gate-pipeline
```

## Always-Required Skills

These are ALWAYS mandatory regardless of task type:

| Skill | Why |
|-------|-----|
| `quality-self-check` | Must verify before claiming done |
| `session-handoff` | Must update state at session end |

## Batch Detection

```
Number of similar items in this session?
├── 1-2 items  → Use individual skill directly
├── 3-5 items  → Add batch-implementation skill
└── >5 items   → Session is too large, split it
```

## Output Format (for action guides)

When listing skills in an action guide, use this format:

```markdown
### Mandatory Reading

#### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — entity construction, validation patterns
2. `.agents/skills/bdd-test-writing/skill.md` — test structure, fixture patterns
3. `.agents/skills/batch-implementation/skill.md` — implementing multiple entities efficiently
4. `.agents/skills/quality-self-check/skill.md` — verification before completion

#### Workflows
- `.agents/workflows/implement-domain.md` — step-by-step: spec → test → entity → verify
- `.agents/workflows/quality-gate-pipeline.md` — tsc → jest → drift-check
```

## Common Session Profiles

### "Domain Foundation" session (Phase 1)
Skills: domain-modeling, bdd-test-writing, batch-implementation
Workflow: implement-domain
Quality: tsc, jest, domain purity grep

### "Infrastructure Wiring" session (Phase 2)
Skills: repository-implementation, (gemini-integration if AI), bdd-test-writing
Workflow: implement-use-case (repos are tested via use cases)
Quality: tsc, jest, integration tests

### "API Layer" session (Phase 3)
Skills: api-controller, bdd-test-writing
Workflow: implement-api
Quality: tsc, jest, OpenAPI spec generation

### "Frontend Page" session (Phase 4)
Skills: frontend-component
Workflow: implement-page
Quality: tsc, next build, manual verification

### "Planning" session (any phase)
Skills: plan-creator, action-guide-creator, skill-mapping
Workflow: create-plan, create-action-guide
Quality: plan has all required sections, action guides pass freshness test
