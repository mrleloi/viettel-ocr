---
description: Full use case implementation from spec to tested, wired code.
---

# Workflow: Implement Use Case

## Steps

### 1. Read Spec
- Read action guide for this use case
- Read relevant domain entities (must exist already)
- Read `tasks/05-data-flow-design.md` for the flow this use case participates in

### 2. Write Integration Test (RED)
- File: `packages/backend/src/application/{context}/__tests__/{name}.use-case.spec.ts`
- Mock repository interfaces + external services
- Test: happy path, validation failures, error propagation
- Run: `jest --testPathPattern="{name}" --bail` → MUST FAIL
- Commit: `test: add specs for {UseCaseName}`

### 3. Write Use Case (GREEN)
- File: `packages/backend/src/application/{context}/{name}.use-case.ts`
- Input/Output DTOs as plain types (not classes)
- Inject repos and services via constructor
- Single `execute()` method
- Run: `jest --testPathPattern="{name}" --bail` → MUST PASS
- Commit: `feat: implement {UseCaseName}`

### 4. Wire in NestJS Module
- Register use case as provider in the bounded context's NestJS module
- Register repository bindings: `{ provide: 'IInvoiceRepository', useClass: InvoiceRepositoryImpl }`

### 5. Verify
```bash
tsc --noEmit
jest --bail  # all tests, not just this one
```

### 6. Refactor
- Clean up, extract helpers
- Run tests → still green
- Commit: `refactor: clean up {UseCaseName}`
