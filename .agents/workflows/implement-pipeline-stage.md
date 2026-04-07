---
description: Implement a processing pipeline stage (classify, extract, validate, map, score, route).
---

# Workflow: Implement Pipeline Stage

## Steps

### 1. Read Spec
- Read `tasks/05-data-flow-design.md` → find the stage in the pipeline diagram
- Read `tasks/01-business-spec.md` → relevant feature (e.g., F03 for classification, F04 for validation)
- Read `.agents/skills/pipeline-stage/skill.md`

### 2. Define Types
- Input type: what this stage receives
- Output type: what this stage produces
- Error types: what can go wrong

### 3. Write Domain Service Test (RED)
- File: `packages/backend/src/domain/processing/__tests__/{stage}.service.spec.ts`
- Test with diverse inputs: valid, edge case, error
- Run → MUST FAIL
- Commit: `test: add specs for {StageName}Service`

### 4. Write Domain Service (GREEN)
- File: `packages/backend/src/domain/processing/{stage}.service.ts`
- Pure logic — no DB, no API, no framework
- Run → MUST PASS
- Commit: `feat: implement {StageName}Service`

### 5. Wire into Pipeline Orchestrator
- Add stage call in `pipeline.service.ts`
- Add trace logging wrapper
- Test pipeline integration

### 6. Verify
```bash
tsc --noEmit && jest --bail
# Verify stage is pure: 
grep -r "@nestjs" packages/backend/src/domain/processing/{stage}* || echo "CLEAN"
```

## Stage Checklist
- [ ] Input/output types defined
- [ ] Domain service is pure (no framework imports)
- [ ] Tests cover: valid input, edge cases, error cases
- [ ] Trace entry created per invocation
- [ ] Error handled gracefully (doesn't crash pipeline)
- [ ] Wired into pipeline orchestrator
