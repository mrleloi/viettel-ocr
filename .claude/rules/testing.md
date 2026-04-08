# Testing Rules

> Auto-loaded. Enforces testing standards.

## Red-Green-Refactor (NON-NEGOTIABLE)

```
1. RED:      Write test → verify it FAILS → commit "test: add specs for X"
2. GREEN:    Write minimum code to PASS → commit "feat: implement X"
3. REFACTOR: Clean up → verify still PASSES → commit "refactor: clean up X"
```

**Never skip the RED phase.** The test must fail first to prove it's actually testing something.

## Test Pyramid

```
         ╱╲
        ╱  ╲         E2E (8-15): Full upload→export flow
       ╱    ╲
      ╱──────╲
     ╱        ╲      Integration (50-80): Use case + DB/mocks
    ╱          ╲
   ╱────────────╲
  ╱              ╲   Unit (200-300): Domain entities, services, value objects
 ╱                ╲
╱──────────────────╲
```

## Test Count Targets

| Milestone | Total | Domain | Infra | App | Interface | E2E |
|-----------|-------|--------|-------|-----|-----------|-----|
| Phase 1 (done) | 406 | 193 | 109 | 59 | 37 | 8 |
| Phase 2 DOD | ≥480 | ~220 | ~130 | ~80 | ~50 | ~15 |

## Unit Tests (Domain Layer)
- No mocks needed (pure logic)
- Test construction validation
- Test state transitions
- Test business rule enforcement
- One factory function per test file (not shared)

## Integration Tests (Application Layer)
- Mock repository interfaces
- Mock external services (Gemini, Viettel API)
- Test use case orchestration
- Test error propagation

## API Tests (Interface Layer)
- Use NestJS testing utilities
- Test HTTP status codes
- Test input validation (DTO validation)
- Test response shape

## Fixtures
- Factory functions per test file: `function createInvoice(overrides?)`
- No shared mutable fixtures across files
- Prefer explicit values over random generators

## Coverage Targets
| Layer | Target | Enforce |
|-------|--------|---------|
| Domain entities + services | ≥ 90% | MANDATORY |
| Use cases | ≥ 80% | MANDATORY |
| Controllers | ≥ 70% | Best effort |
| Frontend components | Best effort | Not enforced |

## What NOT to Test
- Framework boilerplate (NestJS module wiring)
- Generated code (OpenAPI client)
- Simple getters with no logic
- Third-party library internals

## Phase 2 Testing Notes

> Sessions 19 and 24 modify existing domain entity transitions — expect test updates.

- **Session 19 (reprocess)**: `Invoice` entity gets `resumeForReprocess()` transition. This changes terminal-state invariants — expect 3–5 test updates in `invoice.entity.spec.ts`. Verify existing tests PASS before adding new tests.
- **Session 24 (auto-create-schema)**: `Batch` entity gets `autoCreateSchemaOnNewPattern` field. Process pipeline gets new "maybe-create-schema" stage — test the branch/no-branch paths.
- **Session 17 (notifications)**: New `Notification` entity + repo + use cases. Verify event-bus emit pattern in tests (emit mock, assert notification created via handler, NOT directly via repo in the emitting use case).
- **When modifying existing entities**: Always run the full existing test suite FIRST to establish baseline, then add new tests, then implement. Never mix test modification with new feature tests in the same commit.
