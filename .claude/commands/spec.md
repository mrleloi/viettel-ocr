# /spec — Write BDD Test Specification

Write test specs for a domain entity, service, or use case BEFORE implementation.

## Input
$ARGUMENTS — entity or service name (e.g., "Invoice", "FingerprintService", "ProcessInvoiceUseCase")

## Steps

1. **Read business spec**: `tasks/01-business-spec.md` → relevant feature
2. **Read design**: `tasks/06-low-level-design.md` → relevant module
3. **Read DB schema**: `tasks/04-database-design.md` → relevant tables
4. **Read skill**: `.agents/skills/bdd-test-writing/skill.md`
5. **Identify ALL scenarios**:
   - Happy path (normal flow)
   - Edge cases (boundary values, optional fields, empty collections)
   - Error cases (invalid input, missing required, domain violations)
   - State transition cases (status changes, lifecycle)
6. **Write test file** with describe/it blocks
7. **Verify tests FAIL** (implementation doesn't exist)
8. **Commit**: `test: add specs for {Name}`

## Output
Test file at: `packages/backend/src/domain/{context}/__tests__/{name}.spec.ts`
(or `application/` for use cases, `interface/` for controllers)
