# Session 13: Schema Wizard + Mapping Management Pages

> Phase 4.5 + 4.6 — Schema Management + Mapping Pages

---

## §0 Pre-Flight Checklist

- [ ] Read `.context/session-handoff.md` — confirm Session 12 complete
- [ ] Read `.context/agent-notes.md` — note frontend patterns
- [ ] Run `cd invoice-tool\packages\backend; npx jest --bail --no-coverage` — verify green
- [ ] Run `cd invoice-tool\packages\frontend; npx next build` — verify build passes

---

## §1 Context & References

### Spec References
- `documents/01-business-spec.md` — F06 Schema CRUD, F09 Mapping
- `documents/05-data-flow-design.md` — Schema flow, Mapping flow
- `documents/06-low-level-design.md` — Component list

### Architecture Position
```
packages/frontend/
  ├── src/app/schemas/page.tsx         ← Schema list (REPLACE stub)
  ├── src/app/schemas/new/page.tsx     ← Schema wizard (NEW)
  ├── src/app/schemas/[id]/page.tsx    ← Schema detail (NEW)
  ├── src/app/mappings/page.tsx        ← Mapping management (REPLACE stub)
  ├── src/components/schema/           ← NEW schema components
  ├── src/components/mapping/          ← NEW mapping components
  ├── src/lib/api-client.ts            ← Already done (Session 10)
  └── src/lib/constants.ts             ← Add schema/mapping UI text
```

### Existing API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| GET /api/schemas | List all schemas |
| GET /api/schemas/:id | Schema detail |
| POST /api/schemas | Create new schema |
| PUT /api/schemas/:id | Update schema |
| GET /api/mappings | List mappings (filter by schemaId) |
| POST /api/mappings | Create new mapping |

### OS/Shell
- Windows 11, PowerShell
- Avoid `&&`, `grep -r`, bash-isms

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

### 3.1 Schema List Page (Replace Stub)
- Fetch schemas with `apiClient.listSchemas()`
- **Components**:
  - `SchemaCard` — card per schema with name, NCC, MST, status badge, version
  - Grid layout (3 cards per row)
  - Create button → navigate to `/schemas/new`
  - Click card → navigate to `/schemas/[id]`
- Handle loading, error, and empty states

### 3.2 Schema Creation Wizard (New)
- Route: `/schemas/new/page.tsx`
- Multi-step form:
  - Step 1: Basic info (name, nccName, nccTaxId, description)
  - Step 2: Review & confirm
- Submit via `apiClient.createSchema(data)` → redirect to list

### 3.3 Schema Detail Page (New)
- Route: `/schemas/[id]/page.tsx`
- Fetch schema with `apiClient.getSchema(id)`
- Display: name, NCC, MST, status, description, version, timestamps
- Edit functionality for basic fields

### 3.4 Mapping Management Page (Replace Stub)
- Fetch mappings with `apiClient.listMappings()`
- **Components**:
  - `MappingTable` — table with partner product, Viettel product, confidence, source, status
  - `CreateMappingDialog` — modal form for new mapping
  - Schema filter dropdown
- Create button → dialog
- Handle loading, error, empty states

### 3.5 Vietnamese Text Constants
- Add schema-detail and mapping-detail constants to `constants.ts`

---

## §4 Quality Gate

```powershell
# 1. Backend still green
cd invoice-tool\packages\backend; npx tsc --noEmit
cd invoice-tool\packages\backend; npx jest --bail --no-coverage

# 2. Frontend builds
cd invoice-tool\packages\frontend; npx next build

# 3. Manual check: open http://localhost:3001/schemas and verify:
#    - Schema list loads (or shows loading/empty state)
#    - Schema creation wizard works
#    - Mappings page loads with table
```

---

## §5 Acceptance Criteria

1. [ ] Schema list page shows schema cards in grid layout
2. [ ] Schema creation wizard creates new schema via API
3. [ ] Schema detail page displays all schema fields
4. [ ] Mapping table shows all mappings with filters
5. [ ] Create mapping dialog works
6. [ ] `npx next build` passes
7. [ ] All Vietnamese text from constants (no hardcoded strings)

---

## §6 Handoff

- Update `.context/session-handoff.md`
- Update `.context/agent-notes.md` (schema/mapping patterns)
- Create Session 14 action guide: `tasks/action-guides/s14-products-exports-diagnostics.md`
