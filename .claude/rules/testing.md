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
        ╱  ╲         E2E (5-10): Full upload→export flow
       ╱    ╲
      ╱──────╲
     ╱        ╲      Integration (30-50): Use case + DB/mocks
    ╱          ╲
   ╱────────────╲
  ╱              ╲   Unit (100-200): Domain entities, services, value objects
 ╱                ╲
╱──────────────────╲
```

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
