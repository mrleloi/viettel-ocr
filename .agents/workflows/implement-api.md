---
description: Implement NestJS REST endpoint from spec to tested, documented API.
---

# Workflow: Implement API

## Steps

### 1. Read Spec
- Read `tasks/03-high-level-design.md` § API Design for endpoint definition
- Read the use case(s) this endpoint will call

### 2. Write API Test (RED)
- File: `packages/backend/src/interface/http/__tests__/{controller}.spec.ts`
- Test: HTTP status codes, input validation, response shape
- Run → MUST FAIL
- Commit: `test: add API specs for {Endpoint}`

### 3. Write DTOs
- File: `packages/backend/src/interface/dto/{entity}.dto.ts`
- class-validator decorators for input validation
- Swagger @ApiProperty decorators for documentation

### 4. Write Controller (GREEN)
- File: `packages/backend/src/interface/http/{entity}.controller.ts`
- Swagger decorators on every method
- Delegate to use cases — NO business logic
- Run tests → PASS
- Commit: `feat: implement {Endpoint}`

### 5. Register in Module
- Add controller to NestJS module's `controllers` array

### 6. Generate OpenAPI Spec
```bash
# NestJS auto-generates from Swagger decorators
# Access at http://localhost:3000/api/docs
```

### 7. Generate Client (if API contract changed)
```bash
cd packages/shared
npx openapi-typescript-codegen --input ../backend/swagger.json --output src/api/generated
```

### 8. Verify
```bash
tsc --noEmit && jest --bail
```
