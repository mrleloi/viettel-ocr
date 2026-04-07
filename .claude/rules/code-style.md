# Code Style Rules

> Auto-loaded. Enforces consistent code style.

## TypeScript
- `strict: true` in all tsconfig
- No `any` — use `unknown` + type guards when needed
- `import type` for type-only imports
- Explicit return types on all public methods
- Use `readonly` for immutable properties
- Prefer `interface` over `type` for object shapes
- Use `enum` sparingly — prefer string literal unions

## Naming
- Files: kebab-case (`invoice.entity.ts`, `process-invoice.use-case.ts`)
- Classes: PascalCase (`InvoiceService`, `ProcessInvoiceUseCase`)
- Interfaces: PascalCase with `I` prefix for repos (`IInvoiceRepository`)
- Methods: camelCase (`processInvoice()`, `findById()`)
- Constants: SCREAMING_SNAKE for true constants (`MAX_FILE_SIZE_MB`)
- DB columns: snake_case (Drizzle handles mapping)

## Error Handling
- Domain errors: `throw new DomainError('message')` (custom class)
- Infrastructure errors: catch and wrap in domain errors
- Controllers: NestJS exception filters handle translation to HTTP
- Never swallow errors silently — log or rethrow

## Comments
- JSDoc on all public methods: `@param`, `@returns`, `@throws`
- No commented-out code
- No TODO without explanation and context
- Vietnamese comments OK for business rule explanations

## Commits
- `test: add specs for {Feature}` — RED phase
- `feat: implement {Feature}` — GREEN phase
- `refactor: clean up {Feature}` — REFACTOR phase
- `fix: {description}` — Bug fixes
- `docs: {description}` — Documentation, handoff
- `chore: {description}` — Config, deps

## Formatting
- Prettier with defaults (or project .prettierrc if exists)
- Max line length: 100 chars (soft), 120 chars (hard)
- Trailing commas: `all`
- Single quotes
- 2-space indentation
