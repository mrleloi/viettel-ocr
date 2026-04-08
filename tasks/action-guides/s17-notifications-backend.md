# Action Guide: Session 17 — Notification Domain + Backend

> Created: 2026-04-08 | Created by: Antigravity
> Phase Step: 2.A.2 (Foundation & Notifications)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 16 — Navigation fixes, sidebar badge, product sync mock → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → 407 tests green
- [ ] Required files exist:
  - `packages/backend/src/interface/http/event-bus.service.ts` (SSE event bus)
  - `packages/backend/src/infrastructure/database/schema.ts` (notifications table at line 194)
  - `packages/backend/src/infrastructure/database/__tests__/test-db.helper.ts` (notifications DDL at line 189)
  - `packages/backend/src/application/upload/upload-batch.use-case.ts`
  - `packages/backend/src/application/processing/process-invoice.use-case.ts`
  - `packages/backend/src/application/product/sync-products.use-case.ts`

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
Notifications are a core feature of the dashboard (`F09`, §3.9): "In-app notification bell with badge count. Click notification → navigate to the related item/queue. Notification types: error, warning, info." Currently, the `notifications` DB table exists but there is NO domain entity, NO repository, NO use case, NO controller, and NO emitter. The bell in the header has a hardcoded badge with no count, no dropdown, and no click handler.

Reference: `tasks/01-business-spec.md` § F09 — Dashboard & Monitoring (lines 457-461)

### Architecture Context
This session introduces a new bounded context: **NOTIFICATION**. Per the phase 2 master plan (§2.A, Session 17), the correct pattern is:
- **Event-bus emit → notification use case consumes → repo persists**
- Existing use cases (Upload, Process, SyncProducts) will emit events to the EventBus
- A new `CreateNotificationUseCase` will subscribe/be called to persist notifications
- A `NotificationController` handles CRUD + mark-as-read

Reference: `tasks/06-low-level-design.md` § 1 (project structure) and § 5 (SSE)

### Database Tables Involved
| Table | Purpose in this session |
|-------|----------------------|
| `notifications` | Already exists — stores id, category, title, message, relatedEntityType, relatedEntityId, isRead, createdAt |

Reference: `packages/backend/src/infrastructure/database/schema.ts` lines 194-203

### Data Flow
```
Use case action (upload duplicate, process error, low confidence, sync conflict)
  → EventBusService.emit({ type: 'notification.created', data: {...} })
  → Persist via CreateNotificationUseCase + INotificationRepository
  → SSE pushes event to frontend
```

Reference: `tasks/05-data-flow-design.md` (general pipeline)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/domain-modeling/skill.md` — Entity + repo interface patterns for new Notification context
2. `.agents/skills/bdd-test-writing/skill.md` — BDD test patterns for RED phase
3. `.agents/skills/repository-implementation/skill.md` — Drizzle repo pattern for NotificationRepository
4. `.agents/skills/use-case-implementation/skill.md` — Use case pattern for notification CRUD
5. `.agents/skills/api-controller/skill.md` — Controller pattern for NotificationController
6. `.agents/skills/quality-self-check/skill.md` — Always

### Workflows (follow this one)
- `.agents/workflows/implement-domain.md` — For domain entity + repo interface
- `.agents/workflows/implement-use-case.md` — For use cases
- `.agents/workflows/implement-api.md` — For controller
- `.agents/workflows/quality-gate-pipeline.md` — Run before claiming done

### Relevant Learned Rules
- Domain services are stateless: no constructor DI, receive all data as method parameters
- Phase 2: Notification creation MUST go through event-bus emit → NotificationUseCase pattern. NEVER create notifications as side effects inside existing use cases.
- DI Token Convention: `{ provide: 'INotificationRepository', useClass: NotificationRepositoryImpl }`
- `@Inject(DATABASE_TOKEN)` for DB injection
- Module import completeness: Use case depending on `@Inject('INotificationRepository')` needs DatabaseModule (already `@Global()`)
- Smoke test MANDATORY: Session 17 touches `*.module.ts` and `@Inject()` constructors
- OS: Windows + PowerShell — no bash `&&` or `grep -r`

---

## 3. Tasks (Ordered)

### Task 1: Notification Entity + Category Enum + Repository Interface (RED then GREEN)

**Type**: RED → GREEN
**Files**:
- `packages/backend/src/domain/notification/notification.entity.ts`
- `packages/backend/src/domain/notification/notification.repository.ts`
- `packages/backend/src/domain/notification/__tests__/notification.entity.spec.ts`

**What to do**:

1. Create `domain/notification/` directory
2. Write tests FIRST for Notification entity
3. Implement entity + repo interface

**Key types**:
```typescript
/** Notification categories matching business events */
type NotificationCategory =
  | 'duplicate_detected'    // Upload found duplicate file
  | 'low_confidence'        // Processing: confidence < 60%
  | 'processing_error'      // Processing pipeline error
  | 'sync_conflict'         // Product sync found conflict
  | 'schema_suggestion'     // New pattern detected (future: session 24)
  | 'export_completed'      // Export job finished
  | 'info';                 // General informational

/** Related entity types for navigation */
type NotificationEntityType = 'invoice' | 'batch' | 'schema' | 'product' | 'export';

interface NotificationProps {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  relatedEntityType: NotificationEntityType | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface CreateNotificationProps {
  id?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  relatedEntityType?: NotificationEntityType | null;
  relatedEntityId?: string | null;
}
```

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Title required | Must be non-empty string | Empty string → DomainError |
| Message required | Must be non-empty string | Empty string → DomainError |
| Category valid | Must be one of the enum values | Invalid category → DomainError |
| ID auto-generated | If not provided, generate UUID | Generated ID is unique |
| Default isRead | Created notifications are unread | isRead = false on create |
| Mark as read | Transition isRead from false to true | Already-read → no-op (not error) |
| Related entity optional | Can be null | Both type+id null = valid |

**Repository interface**:
```typescript
interface INotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findAll(options?: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<Notification[]>;
  countUnread(): Promise<number>;
  save(notification: Notification): Promise<void>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
}
```

**Verify**: `npx jest --testPathPattern="notification.entity" --bail`

---

### Task 2: Notification Repository Implementation (RED then GREEN)

**Type**: RED → GREEN
**Files**:
- `packages/backend/src/infrastructure/database/repositories/notification.repository.impl.ts`
- `packages/backend/src/infrastructure/database/repositories/__tests__/notification.repository.impl.spec.ts`

**What to do**:
1. Write integration tests using `createTestDb()` helper (notifications table already exists in DDL)
2. Implement Drizzle repo mapping entity ↔ DB `notifications` table

**Key mapping** (entity → DB):
```
id → id
category → category
title → title
message → message
relatedEntityType → related_entity_type
relatedEntityId → related_entity_id
isRead → is_read (boolean ↔ integer 0/1)
createdAt → created_at (Date ↔ ISO string)
```

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Save (insert/update) | Upsert by id | Duplicate id → update |
| Find by id | Return null if not found | Non-existent id → null |
| Find all (unread only) | Filter where isRead = false | Empty list when all read |
| Find all (limit/offset) | Paginate, default newest first (ORDER BY created_at DESC) | Offset beyond total → empty |
| Count unread | COUNT WHERE is_read = 0 | 0 when no notifications |
| Mark as read | UPDATE is_read = 1 WHERE id | Non-existent id → no error |
| Mark all as read | UPDATE is_read = 1 WHERE is_read = 0 | No unread → no error |

**Verify**: `npx jest --testPathPattern="notification.repository.impl" --bail`

---

### Task 3: Notification Use Cases (RED then GREEN)

**Type**: RED → GREEN
**Files**:
- `packages/backend/src/application/notification/create-notification.use-case.ts`
- `packages/backend/src/application/notification/list-notifications.use-case.ts`
- `packages/backend/src/application/notification/mark-notification-read.use-case.ts`
- `packages/backend/src/application/notification/__tests__/notification-use-cases.spec.ts`

**What to do**:
1. Write tests for all 3 use cases with mocked repo
2. Implement use cases

**Key types**:
```typescript
// CreateNotificationUseCase
interface CreateNotificationInput {
  category: NotificationCategory;
  title: string;
  message: string;
  relatedEntityType?: NotificationEntityType | null;
  relatedEntityId?: string | null;
}
interface CreateNotificationOutput {
  id: string;
  category: string;
  title: string;
  createdAt: string;
}

// ListNotificationsUseCase
interface ListNotificationsInput {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}
interface ListNotificationsOutput {
  notifications: NotificationDto[];
  unreadCount: number;
}

// MarkNotificationReadUseCase
interface MarkNotificationReadInput {
  id?: string; // If omitted, mark ALL as read
}
```

**Business rules to encode**:
| Rule | Logic | Edge case |
|------|-------|-----------|
| Create persists + returns | Save to repo, return id + metadata | — |
| Create emits SSE event | Emit `notification.created` to EventBus | EventBus not available → log warning |
| List with unreadOnly | Pass filter to repo | No notifications → empty array |
| List returns unreadCount | Always include total unread count from repo | — |
| Mark read by id | Delegate to repo.markAsRead(id) | ID not found → no error |
| Mark all read | Delegate to repo.markAllAsRead() | — |

**Verify**: `npx jest --testPathPattern="notification-use-cases" --bail`

---

### Task 4: Notification Controller + DTOs (RED then GREEN)

**Type**: RED → GREEN
**Files**:
- `packages/backend/src/interface/http/notification.controller.ts`
- `packages/backend/src/interface/http/dto/notification.dto.ts`
- `packages/backend/src/interface/http/__tests__/notification.controller.spec.ts`

**What to do**:
1. Write controller tests
2. Implement controller + DTOs with Swagger decorators

**Endpoints**:
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/notifications` | List notifications (query: `unreadOnly`, `limit`, `offset`) |
| GET | `/api/notifications/unread-count` | Get unread count only |
| POST | `/api/notifications/:id/read` | Mark single notification as read |
| POST | `/api/notifications/read-all` | Mark all as read |

**Verify**: `npx jest --testPathPattern="notification.controller" --bail`

---

### Task 5: Add `notification.created` event type to EventBusService

**Type**: GREEN
**File**: `packages/backend/src/interface/http/event-bus.service.ts`

**What to do**:
Add `'notification.created'` to the `ServerEventType` union type.

---

### Task 6: Hook notification emission into existing use cases

**Type**: GREEN
**Files**:
- `packages/backend/src/application/upload/upload-batch.use-case.ts` — emit on duplicate detected
- `packages/backend/src/application/processing/process-invoice.use-case.ts` — emit on low confidence (<60%) and on error
- `packages/backend/src/application/product/sync-products.use-case.ts` — emit on sync conflict

**What to do**:
Each use case should call `CreateNotificationUseCase.execute()` at the appropriate point:
- **UploadBatchUseCase**: After detecting a duplicate → create notification with category `duplicate_detected`, relatedEntityType `invoice`, relatedEntityId = invoice.id
- **ProcessInvoiceUseCase**: After scoring, if confidence < 0.60 → `low_confidence`; on pipeline error → `processing_error`
- **SyncProductsUseCase**: After detecting conflicts → `sync_conflict`, relatedEntityType `product`

**Pattern**: Inject `CreateNotificationUseCase` into the above use cases via NestJS DI (not via string token — use class directly since they're in the same module). Use try/catch around notification creation so failures don't break the main flow.

---

### Task 7: Register & Wire NestJS Modules

**Type**: GREEN
**Files**:
- `packages/backend/src/infrastructure/database/database.module.ts` — add NotificationRepositoryImpl provider + `INotificationRepository` token
- `packages/backend/src/application/application.module.ts` — add notification use cases
- `packages/backend/src/interface/http/interface.module.ts` — add NotificationController

**What to do**:
1. Add `{ provide: 'INotificationRepository', useClass: NotificationRepositoryImpl }` to DatabaseModule providers + exports
2. Add all 3 notification use cases to ApplicationModule providers + exports
3. Add NotificationController to InterfaceModule controllers

**Verify**: Run smoke test → `powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"`

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from packages/backend/ directory
npx tsc --noEmit

# Tests — from packages/backend/ directory
npx jest --bail

# Backend smoke test (MANDATORY — *.module.ts and @Inject changed) — from project root
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\smoke-test.ps1"

# Architecture check (domain work) — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
#   query ": any" in packages/backend/src/domain/  → expect 0 results
#   query "from.*infrastructure" (regex) in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] `Notification` entity exists in `domain/notification/` with create, reconstitute, markAsRead methods
- [ ] `INotificationRepository` interface exists with findById, findAll, countUnread, save, markAsRead, markAllAsRead
- [ ] `NotificationRepositoryImpl` implements the repo with Drizzle + SQLite
- [ ] `CreateNotificationUseCase` creates + persists + emits SSE event
- [ ] `ListNotificationsUseCase` returns paginated list + unreadCount
- [ ] `MarkNotificationReadUseCase` marks single or all as read
- [ ] `NotificationController` serves 4 endpoints under `/api/notifications`
- [ ] `ServerEventType` includes `'notification.created'`
- [ ] Upload of a duplicate file creates a `duplicate_detected` notification row
- [ ] Processing with confidence < 60% creates a `low_confidence` notification row
- [ ] Processing error creates a `processing_error` notification row
- [ ] Product sync conflict creates a `sync_conflict` notification row
- [ ] All new tests pass (target: ≥430 total tests)
- [ ] `tsc --noEmit` passes
- [ ] `smoke-test.ps1` passes
- [ ] No architecture violations (no @nestjs, drizzle-orm, or infrastructure imports in domain/)
- [ ] Session handoff updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Notification bounded context fully implemented (domain → repo → use cases → controller → hooks → SSE)
   - Found: {any surprises}
   - What's Next: "Session 18: Notification bell + frontend wiring" (Phase 2.A.3)

2. Update `.context/agent-notes.md`:
   - Progress counters (test count, entity count, etc.)
   - Any new learned rules

3. Update `tasks/progress.md`:
   - Mark Session 17 / 2.A.2 as ✅ Done

**Next session depends on**: Session 17's NotificationController endpoints (`GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`) and the `notification.created` SSE event type.
