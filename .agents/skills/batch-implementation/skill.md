---
name: Batch Implementation
description: Pattern for implementing 3+ related items in a single session.
context-load: once
---

# Skill: Batch Implementation

## When to Use
Implementing 3+ domain entities, services, or use cases in a single session.

## Pre-Implementation Checklist

```
1. Read ALL action guides for this session
2. Identify shared patterns:
   - Similar entity structures → reuse test fixtures shapes
   - Shared value objects → implement those FIRST
   - Cross-entity references → plan dependency order
3. Plan implementation ORDER (dependency-first):
   - Value objects and shared types first
   - Entities without dependencies second
   - Entities that reference others third
   - Services that use multiple entities last
```

## Implementation Loop

For each item in the batch:

```
Step 1: Write test file (RED)
  Run: jest --testPathPattern="{name}" --bail → MUST FAIL

Step 2: Write implementation (GREEN)
  Run: jest --testPathPattern="{name}" --bail → MUST PASS

Step 3: Incremental verify
  Run: jest --bail → no regressions in existing tests

Step 4: Commit
  "test: add specs for {name}" (if RED committed separately)
  "feat: implement {name}"
```

> **CRITICAL**: Run `jest --bail` (all tests) after EVERY item, not just at the end.
> Catch regressions immediately.

## Shared Fixture Pattern

```typescript
// In EACH test file, create a factory (NOT shared across files):
function createSchema(overrides?: Partial<SchemaProps>): Schema {
  return Schema.create({
    name: 'Test Schema',
    nccName: 'Test NCC',
    status: 'active',
    ...overrides,
  });
}
```

## Session Budget

- Aim for 3-5 items per session
- If >5 items → split session or warn user
- Run full test suite at least 3 times: start, middle, end
