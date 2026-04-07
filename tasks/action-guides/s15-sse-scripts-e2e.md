# Action Guide: Session 15 — SSE Integration + Setup/Start Scripts + E2E Testing

> Created: 2026-04-07 | Created by: Antigravity
> Phase Step: 4.10 + 5.1 + 5.2 + 5.3
> Target Agent: Developer

---

## §0 Pre-Flight Checklist

- [ ] Session 14 complete → `.context/session-handoff.md` confirms done
- [ ] Backend tests green: `cd invoice-tool\packages\backend; npx jest --bail --no-coverage`
- [ ] Frontend build passes: `cd invoice-tool\packages\frontend; npx next build`
- [ ] All 12 frontend routes working (/, /upload, /review, /review/[id], /schemas, /schemas/new, /schemas/[id], /mappings, /products, /exports, /diagnostics)

**If any check fails → STOP. Fix before proceeding.**

---

## §1 Context

### Business Requirement
- **F13 — Real-time Updates**: SSE event stream for live processing status updates
- **Setup/Start**: One-command project setup and start for new developers
- **E2E Testing**: Full flow validation upload → process → review → export

Reference: `tasks/01-business-spec.md` § F13, deployment requirements

### Architecture Context
- SSE endpoint already defined in controller layer (ExportController has pattern)
- Backend has NestJS SSE support via `@Sse()` decorator
- Frontend needs EventSource client connecting to `/api/events`
- Setup script: `npm run setup` → install deps, create DB, seed data
- Start script: `npm start` → start backend + frontend concurrently

### Existing Infrastructure
| Component | Status | Location |
|-----------|--------|----------|
| Backend server | ✅ Working | `packages/backend/src/main.ts` |
| Frontend dev server | ✅ Working | `packages/frontend/` |
| Database auto-migration | ✅ Working | `connection.ts initializeTables()` |
| API proxy | ✅ Working | `next.config.ts rewrites` |
| Health endpoint | ✅ Working | GET /api/health |
| All controllers | ✅ Working | 7 controllers, 17 endpoints |

### OS/Shell
- Windows 11, PowerShell
- Avoid `&&`, `grep -r`, bash-isms
- Use cross-platform scripts (Node.js preferred over bash)

---

## §2 Mandatory Reading

### Skills
1. `.agents/skills/frontend-component/skill.md` — SSE integration patterns
2. `.agents/skills/bdd-test-writing/skill.md` — E2E test writing
3. `.agents/skills/quality-self-check/skill.md` — always

### Workflows
1. `.agents/workflows/quality-gate-pipeline.md` — pre-commit checks
2. `.agents/workflows/session-handoff.md` — session lifecycle

### Relevant Learned Rules
- **Backend smoke test**: Run after any `*.module.ts` changes
- **NestJS SSE**: Use `@Sse()` decorator with `Observable<MessageEvent>`
- **Cross-platform**: Use `concurrently` npm package for parallel processes
- **Database auto-migration**: Tables created on first run via `initializeTables()`

---

## §3 Tasks (Ordered)

### Task 1: SSE Event Endpoint (Backend)

**Type**: GREEN (implement)
**File**: `packages/backend/src/interface/http/events.controller.ts` (NEW)

**What to do**:
- Create `EventsController` with `@Sse('events')` endpoint
- Emit events: `invoice.processed`, `batch.completed`, `invoice.needs_review`
- Use RxJS `Subject` as event bus
- Create `EventBusService` injectable that other services can publish to
- Register in `InterfaceModule`

**Key types**:
```typescript
interface ServerEvent {
  type: 'invoice.processed' | 'batch.completed' | 'invoice.needs_review';
  data: Record<string, unknown>;
  timestamp: string;
}
```

### Task 2: SSE Client (Frontend)

**Type**: GREEN (implement)
**File**: `packages/frontend/src/lib/sse-client.ts` (NEW)

**What to do**:
- Create `useServerEvents()` React hook
- Connect to `/api/events` via `EventSource`
- Auto-reconnect on disconnect with exponential backoff
- Expose event stream to components (dashboard auto-refresh, review badge update)
- Wire into Dashboard page for real-time stat updates

### Task 3: Setup Script

**Type**: GREEN (implement)
**File**: `scripts/setup.js` (NEW) + update `package.json`

**What to do**:
- `npm run setup` script that:
  1. Checks Node.js version (>=18)
  2. Runs `npm install` in monorepo root
  3. Copies `config.env.example` → `config.env` (if not exists)
  4. Runs backend build to verify compilation
  5. Prints success message with next steps
- Add to root `package.json` scripts: `"setup": "node scripts/setup.js"`

### Task 4: Start Script

**Type**: GREEN (implement)
**File**: Update root `package.json`

**What to do**:
- `npm start` that starts both backend (port 3000) and frontend (port 3001)
- Use `concurrently` package: `concurrently "npm run -w packages/backend start:dev" "npm run -w packages/frontend dev"`
- Add `concurrently` as devDependency
- Verify both servers start and API proxy works

### Task 5: E2E Test — Full Flow

**Type**: RED then GREEN
**File**: `packages/backend/src/__tests__/e2e/` (NEW directory)

**What to do**:
- Create E2E test that exercises full API flow:
  1. POST /api/batches (upload) → batch created
  2. GET /api/batches/:id → batch status
  3. GET /api/invoices → list invoices from batch
  4. POST /api/invoices/:id/approve → approve invoice
  5. POST /api/exports → create export
- Use supertest with real NestJS app (TestingModule)
- Test with in-memory SQLite

### Task 6: Seed Data Script (Optional)

**Type**: GREEN (implement)
**File**: `scripts/seed.js` (NEW)

**What to do**:
- Create seed script that populates demo data:
  - 2 schemas (Digiworld, Samsung)
  - 5 products with codes
  - 3 mappings
- Run via `npm run seed`

---

## §4 Quality Gate

```powershell
# 1. Backend type check
cd c:\htdocs\viettel-ocr\invoice-tool\packages\backend
npx tsc --noEmit

# 2. Backend tests (including new E2E)
npx jest --bail --no-coverage

# 3. Backend smoke test
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# 4. Frontend builds
cd c:\htdocs\viettel-ocr\invoice-tool\packages\frontend
npx next build

# 5. Verify start script works
cd c:\htdocs\viettel-ocr\invoice-tool
npm start
# → both servers should start, verify http://localhost:3001 loads
```

---

## §5 Acceptance Criteria

1. [ ] SSE endpoint `/api/events` returns event stream
2. [ ] Frontend `useServerEvents()` hook connects and receives events
3. [ ] `npm run setup` installs deps and creates config
4. [ ] `npm start` starts both backend and frontend
5. [ ] E2E test passes full upload→approve→export flow
6. [ ] All 391+ backend tests still pass
7. [ ] `npx next build` passes with all routes
8. [ ] Backend smoke test passes
9. [ ] Session handoff updated

---

## §6 Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: SSE + scripts + E2E
   - Found: Any surprises
   - What's Next: "Phase 5.4-5.6 — Config validation, error polish, performance"

2. Update `.context/agent-notes.md`:
   - SSE patterns learned
   - E2E test patterns

3. Update `tasks/progress.md`:
   - Mark 4.10, 5.1, 5.2, 5.3 as ✅ Done

**This is the final planned session. After this, the MVP is feature-complete.**
