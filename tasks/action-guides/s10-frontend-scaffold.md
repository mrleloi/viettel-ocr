# Session 10: OpenAPI Client Generation + Frontend Layout

> Phase 3.2 + 4.1 — OpenAPI Client + Next.js Layout & Navigation

---

## §0 Pre-Flight Checklist

- [ ] Read `.context/session-handoff.md` — confirm 391 tests pass
- [ ] Read `.context/agent-notes.md` — note Session 9 interface patterns
- [ ] Run `cd invoice-tool\packages\backend; npx jest --bail --no-coverage` — verify green
- [ ] Confirm `npx tsc --noEmit` passes

---

## §1 Context & References

### Spec References
- `documents/06-low-level-design.md` — frontend structure, component list
- `documents/05-data-flow-design.md` — API endpoints consumed by frontend
- `documents/03-high-level-design.md` — frontend architecture overview

### Architecture Position
```
packages/frontend/  ← YOU ARE HERE
  ├── app/ (Next.js App Router)
  │   ├── layout.tsx (root layout with sidebar + header)
  │   ├── page.tsx (dashboard)
  │   └── route folders
  └── lib/
      └── api/ (generated OpenAPI client)

packages/shared/
  └── src/api/generated/ (OpenAPI types)
```

### Existing API Endpoints (17 total — Session 9)
| Prefix | Endpoints |
|--------|-----------|
| /api/batches | POST /, GET /, GET /:id |
| /api/invoices | GET /, GET /:id, POST /:id/approve, POST /:id/reject, PUT /:id |
| /api/schemas | POST /, GET /, GET /:id, PUT /:id |
| /api/mappings | POST /, GET / |
| /api/products | POST /sync, GET / |
| /api/exports | POST /, GET /:id/download |
| /api/health | GET / |

### OS/Shell
- Windows 11, PowerShell
- Avoid `&&`, `grep -r`, bash-isms
- Test command: `cd invoice-tool\packages\backend; npx jest --bail --no-coverage`

---

## §2 Mandatory Reading

### Skills
1. **Frontend Component** (`skills/frontend-component/skill.md`) — Next.js page/component patterns
2. **Quality Self-Check** (`skills/quality-self-check/skill.md`) — post-implementation checklist

### Workflows
1. **Implement Page** (`workflows/implement-page.md`) — frontend page implementation
2. **Quality Gate Pipeline** (`workflows/quality-gate-pipeline.md`) — pre-commit checks

---

## §3 Tasks

### 3.1 Generate Swagger JSON
- Start backend temporarily with Swagger enabled
- Add `SwaggerModule.setup()` in `main.ts` (guarded by `NODE_ENV !== 'production'`)
- Export `swagger.json` for API client generation
- OR: use NestJS CLI to generate spec without running server

### 3.2 Generate TypeScript API Client
- Use `openapi-typescript-codegen` or `openapi-fetch` to generate typed client from Swagger spec
- Output to `packages/shared/src/api/generated/` or `packages/frontend/lib/api/`
- Generated client should provide typed fetch functions for all 17 endpoints

### 3.3 Frontend Layout Structure
- Create root `layout.tsx` with:
  - Sidebar navigation (collapsible)
  - Header with app title + notification bell placeholder
  - Main content area
- Navigation items: Dashboard, Upload, Review, Schemas, Products, Mappings, Exports
- Use CSS modules or inline styles for the layout (no Tailwind unless requested)

### 3.4 Route Structure
```
app/
├── layout.tsx (root layout with sidebar)
├── page.tsx (dashboard — redirect or stub)
├── upload/ page.tsx
├── review/ page.tsx
├── schemas/ page.tsx
├── products/ page.tsx
├── mappings/ page.tsx
└── exports/ page.tsx
```

### 3.5 API Client Integration
- Set up base URL configuration (env variable `NEXT_PUBLIC_API_URL`)
- Create typed wrapper functions around generated client
- Handle auth headers (placeholder for future)

---

## §4 Quality Gate

```powershell
# 1. Backend still green
cd invoice-tool\packages\backend; npx tsc --noEmit
cd invoice-tool\packages\backend; npx jest --bail --no-coverage

# 2. Frontend builds
cd invoice-tool\packages\frontend; npx next build

# 3. Domain purity unchanged
# Use grep_search tool on domain/ for @nestjs — expect 0 results
```

---

## §5 Acceptance Criteria

1. [ ] Swagger spec generated and accessible at /api/docs (dev mode)
2. [ ] TypeScript API client generated with typed functions for all endpoints
3. [ ] Root layout with sidebar navigation renders correctly
4. [ ] All route pages exist (at least as stubs)
5. [ ] `npx tsc --noEmit` passes (backend)
6. [ ] `npx next build` passes (frontend)

---

## §6 Handoff

- Update `.context/session-handoff.md`
- Update `.context/agent-notes.md` (test count, Phase 3/4 progress)
- Create Session 11 action guide: `tasks/action-guides/s11-dashboard-upload.md`
