---
description: Full domain entity implementation from spec to tested code.
---

# Workflow: Implement Domain

## Steps

### 1. Read Spec
- Read `tasks/01-business-spec.md` for the feature
- Read `tasks/04-database-design.md` for the entity's table
- Read action guide (if provided by Architect)

### 2. Write Test File (RED)
- File: `packages/backend/src/domain/{context}/__tests__/{entity}.spec.ts`
- Follow `.agents/skills/bdd-test-writing/skill.md`
- Include: create, validate, state transitions, edge cases, error cases
- Run: `jest --testPathPattern="{entity}" --bail` → MUST FAIL
- Commit: `test: add specs for {Entity}`

### 3. Write Value Objects
- File: `packages/backend/src/domain/{context}/{entity}.value-objects.ts`
- Self-validating, immutable
- Run tests → some should now pass

### 4. Write Entity
- File: `packages/backend/src/domain/{context}/{entity}.entity.ts`
- Use `static create()` and `static reconstitute()` pattern
- Validate on construction
- Run tests → all entity tests should pass

### 5. Write Repository Interface
- File: `packages/backend/src/domain/{context}/{entity}.repository.ts`
- Interface only — no implementation here
- Commit: `feat: implement {Entity} domain model`

### 6. Verify
```bash
tsc --noEmit                           # Types OK
jest --testPathPattern="{entity}"      # All green
grep -r "@nestjs" packages/backend/src/domain/{context}/  # 0 results
```

### 7. Refactor
- Clean up, extract shared logic
- Run tests again → still green
- Commit: `refactor: clean up {Entity}`

## Quality Checklist
- [ ] Entity validates on construction
- [ ] Value objects are immutable + self-validating
- [ ] Repository interface in domain/ (not infrastructure/)
- [ ] Zero @nestjs imports in domain/
- [ ] Tests cover: happy path + ≥2 edge cases + ≥1 error case
- [ ] JSDoc on all public methods
