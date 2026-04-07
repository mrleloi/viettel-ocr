# Architecture Rules

> Auto-loaded by Claude Code. Enforces layer boundaries and patterns.

## Layer Boundary Map (MOST CRITICAL)

```
domain/          → imports from: shared/domain/ ONLY. Zero framework deps.
application/     → imports from: domain/ (entities, interfaces, services)
infrastructure/  → imports from: domain/ (implements interfaces), @nestjs/*, drizzle
interface/       → imports from: application/ (use cases), dto/

NEVER: domain/ → @nestjs/*
NEVER: domain/ → infrastructure/
NEVER: domain/ → application/ (domain doesn't know about use cases)
NEVER: interface/ → domain/ directly (must go through application/)
```

## Entity Rules
- Entities validate on construction via `static create()`
- `static reconstitute()` for DB hydration (skip validation)
- Expose data via getters, mutate via named methods
- State transitions via methods that enforce invariants
- No @Column, @Entity, or any ORM decorators

## Value Object Rules
- Immutable (readonly properties)
- Self-validating (throw on invalid input)
- Equality by value (`equals()` method)
- Examples: TaxId, Money, InvoiceNumber, Confidence

## Repository Rules
- Interface in `domain/{context}/{entity}.repository.ts`
- Implementation in `infrastructure/database/repositories/{entity}.repository.impl.ts`
- Implementation uses Drizzle ORM
- NestJS DI token: `@Inject('I{Entity}Repository')`

## Use Case Rules
- One use case = one public `execute()` method
- Orchestrates domain services + repositories
- Returns result DTO (not entity)
- Handles transaction boundaries

## Controller Rules
- Thin — delegate ALL logic to use cases
- Swagger decorators for OpenAPI generation
- DTO classes with class-validator decorators
- No business logic, no DB access

## NestJS Module Organization
- One NestJS module per bounded context
- Module registers: controllers, use cases, domain services, repository implementations
- Cross-context dependency: import the other module (not internal services)

## Frontend Rules
- Pages in `app/` directory (Next.js App Router)
- Components receive props only — no direct API calls inside components
- API calls via generated OpenAPI client or React Query hooks
- Server Components default — Client Components only for interactivity
- Zustand for UI state, React Query for server state

## Data Flow

```
Frontend (React Query) → HTTP → Controller → Use Case → Domain Service → Repository → SQLite
                                                      → Gemini Client → Gemini API
```

## File Naming

```
Domain:        invoice.entity.ts, invoice.value-objects.ts, invoice.repository.ts, invoice.service.ts
Application:   process-invoice.use-case.ts, approve-invoice.use-case.ts
Infrastructure: invoice.repository.impl.ts, gemini.client.ts
Interface:     invoice.controller.ts, invoice.dto.ts
Tests:         invoice.entity.spec.ts, process-invoice.use-case.spec.ts
```
