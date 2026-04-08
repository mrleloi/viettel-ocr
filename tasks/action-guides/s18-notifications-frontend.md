# Action Guide: Session 18 — Notification Bell + Frontend Wiring

> Created: 2026-04-08 | Created by: Antigravity
> Phase Step: 2.A.3 (Foundation & Notifications)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 17 — Notification domain + backend → check `.context/session-handoff.md`
- [ ] Backend tests passing: `npx jest --bail` (from `packages/backend/`) → 455 tests green
- [ ] Frontend build green: `npm run build` (from `packages/frontend/`)
- [ ] Required backend endpoints exist:
  - `GET /api/notifications` → `NotificationController.list()` returns `{ notifications: [...], unreadCount: number }`
  - `GET /api/notifications/unread-count` → returns `{ unreadCount: number }`
  - `POST /api/notifications/:id/read` → 204 No Content
  - `POST /api/notifications/read-all` → 204 No Content
- [ ] SSE event type `notification.created` exists in `event-bus.service.ts`

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement
Notifications are a core feature of the dashboard (`F09`, §3.9): "In-app notification bell với badge count. Click notification → navigate trực tiếp đến item/queue tương ứng. Notification types: error, warning, info." Currently, the backend is fully implemented (Session 17: entity + repo + use cases + controller + SSE event + hooks in existing use cases). The **frontend** bell in the header has a hardcoded badge with no count, no dropdown, and no click handler.

Reference: `tasks/01-business-spec.md` § F09 — Dashboard & Monitoring

### Architecture Context
This is a **frontend-only** session. All backend APIs are ready from Session 17. The work is:
- Add notification API methods to the typed API client
- Add `notification.created` to the SSE client event types
- Create a `useNotifications` hook for state management (polling + SSE)
- Build a `NotificationBell` dropdown component
- Wire it into the existing `Header.tsx`

No NestJS module changes → NO smoke test needed.

### Data Flow
```
Backend emits SSE `notification.created` event
  → Frontend `useServerEvents` hook receives it
  → `useNotifications` hook increments unread count + prepends to list
  → `NotificationBell` component re-renders with updated badge + dropdown
  
User clicks bell → dropdown opens with notification list
User clicks notification → mark as read + navigate to related entity
User clicks "Mark all read" → calls POST /api/notifications/read-all → badge resets
```

### Backend API Responses (Session 17 output)
```typescript
// GET /api/notifications?unreadOnly=true&limit=20
{
  notifications: [
    {
      id: string;
      category: string;  // 'duplicate_detected' | 'low_confidence' | 'processing_error' | 'sync_conflict' | ...
      title: string;
      message: string;
      relatedEntityType: string | null;  // 'invoice' | 'batch' | 'schema' | 'product' | 'export'
      relatedEntityId: string | null;
      isRead: boolean;
      createdAt: string;  // ISO timestamp
    }
  ],
  unreadCount: number
}

// GET /api/notifications/unread-count
{ unreadCount: number }

// POST /api/notifications/:id/read → 204
// POST /api/notifications/read-all → 204
```

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/frontend-component/skill.md` — Component patterns for Next.js pages
2. `.agents/skills/quality-self-check/skill.md` — Always

### Workflows (follow this one)
- `.agents/workflows/implement-page.md` — Frontend page implementation workflow
- `.agents/workflows/quality-gate-pipeline.md` — Run before claiming done

### Relevant Learned Rules
- **No React Query**: Using `useState` + `useEffect` + `useCallback` for data fetching (agent-notes §Frontend Patterns)
- **Vietnamese text**: All UI strings via `src/lib/constants.ts` `VI` constant — NO hardcoded Vietnamese in JSX
- **API client pattern**: Generic `apiFetch<T>()` with typed methods in `apiClient` namespace
- **SSE client**: `useServerEvents` hook subscribes to `/api/events` via EventSource
- **Page data fetching pattern**: `useState` for data/loading/error → `useCallback` → `useEffect`
- **Toast pattern**: `{ message, type }` state → `setTimeout(() => setToast(null), 3000)` for auto-dismiss
- OS: Windows + PowerShell

---

## 3. Tasks (Ordered)

### Task 1: Add notification types + API methods to api-client.ts

**Type**: GREEN
**File**: `packages/frontend/src/lib/api-client.ts`

**What to do**:
1. Add `NotificationResponse` and `NotificationListResponse` types matching backend DTOs
2. Add 4 API methods to `apiClient`:
   - `listNotifications(params?)` → `GET /notifications`
   - `getUnreadCount()` → `GET /notifications/unread-count`
   - `markNotificationRead(id)` → `POST /notifications/:id/read`
   - `markAllNotificationsRead()` → `POST /notifications/read-all`

**Key types**:
```typescript
export interface NotificationResponse {
  id: string;
  category: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
```

---

### Task 2: Add `notification.created` to SSE client event types

**Type**: GREEN
**File**: `packages/frontend/src/lib/sse-client.ts`

**What to do**:
1. Add `'notification.created'` to `ServerEventType` union
2. Add `'notification.created'` to the `eventTypes` array in `useServerEvents` connect function

---

### Task 3: Add notification Vietnamese strings to constants.ts

**Type**: GREEN
**File**: `packages/frontend/src/lib/constants.ts`

**What to do**:
Expand `VI.notification` with all needed strings:

```typescript
notification: {
  title: 'Thông báo',
  noNew: 'Không có thông báo mới',
  markAllRead: 'Đánh dấu tất cả đã đọc',
  viewAll: 'Xem tất cả',
  justNow: 'Vừa xong',
  minutesAgo: 'phút trước',
  hoursAgo: 'giờ trước',
  daysAgo: 'ngày trước',
  categories: {
    duplicate_detected: 'Phát hiện trùng lặp',
    low_confidence: 'Độ tin cậy thấp',
    processing_error: 'Lỗi xử lý',
    sync_conflict: 'Xung đột đồng bộ',
    schema_suggestion: 'Gợi ý mẫu mới',
    export_completed: 'Xuất hoàn tất',
    info: 'Thông tin',
  },
},
```

---

### Task 4: Create `useNotifications` custom hook

**Type**: GREEN
**File**: `packages/frontend/src/lib/useNotifications.ts`

**What to do**:
Create a custom hook that:
1. Fetches notification list + unread count on mount
2. Polls unread count every 30 seconds
3. Listens for `notification.created` SSE events to update in real-time
4. Provides `markAsRead(id)` and `markAllAsRead()` actions

**Interface**:
```typescript
interface UseNotificationsReturn {
  notifications: NotificationResponse[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

**Key behavior**:
| Behavior | Logic | Edge case |
|----------|-------|-----------|
| Initial fetch | GET /notifications?limit=20 on mount | API error → empty list, log warning |
| Polling | GET /notifications/unread-count every 30s | Backend down → keep stale count |
| SSE update | On `notification.created` → increment unreadCount + prepend to list | Duplicate event → idempotent (check ID) |
| Mark as read | POST /notifications/:id/read → update local state | Already read → no-op |
| Mark all read | POST /notifications/read-all → set all isRead=true, unreadCount=0 | Empty list → no-op |

---

### Task 5: Create `NotificationBell` component

**Type**: GREEN
**File**: `packages/frontend/src/components/layout/NotificationBell.tsx`

**What to do**:
Build a dropdown component:
1. Bell icon button with animated badge (unread count)
2. Click bell → toggle dropdown
3. Dropdown shows notification list (max 10 items)
4. Each item: category icon + title + relative time + unread indicator
5. Click item → mark as read + navigate to related entity
6. "Mark all as read" button at bottom
7. Click outside dropdown → close
8. Empty state when no notifications

**Category → icon mapping**:
```
duplicate_detected → ⚠️
low_confidence → 📊
processing_error → ❌
sync_conflict → 🔄
schema_suggestion → 📋
export_completed → ✅
info → ℹ️
```

**Category → navigation mapping**:
```
relatedEntityType === 'invoice' → /review/{relatedEntityId}
relatedEntityType === 'batch' → /batches/{relatedEntityId}
relatedEntityType === 'schema' → /schemas/{relatedEntityId}
relatedEntityType === 'product' → /products
relatedEntityType === 'export' → /exports
null → no navigation (just mark as read)
```

---

### Task 6: Update Header.tsx to use NotificationBell

**Type**: GREEN
**File**: `packages/frontend/src/components/layout/Header.tsx`

**What to do**:
Replace the hardcoded bell button with `<NotificationBell />` component.
The bell manages its own state via `useNotifications` hook internally.

---

### Task 7: Add notification CSS to globals.css

**Type**: GREEN
**File**: `packages/frontend/src/app/globals.css`

**What to do**:
Add notification-specific CSS at the end of the file:
- `.notification-bell` — relative positioning for dropdown anchor
- `.notification-badge` — absolute positioned red circle with count, pulse animation
- `.notification-dropdown` — absolute dropdown panel, dark themed, shadow, max-height with scroll
- `.notification-item` — list item with hover, unread state (left border accent), category icon
- `.notification-item-unread` — bold text, left accent border
- `.notification-empty` — centered empty state
- `.notification-header` — dropdown header with title + "mark all read" link
- `.notification-time` — relative time in muted color

Style must match existing premium dark theme (reference: existing `.header-*`, `.sidebar` CSS patterns in globals.css).

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Frontend build — from packages/frontend/ directory
npm run build

# Frontend typecheck — from packages/frontend/ directory  
npm run typecheck

# Backend tests still pass (sanity — no backend changes, but verify nothing broken)
# From packages/backend/ directory
npx jest --bail
```

**Pass criteria**: ALL commands succeed, 0 errors.

**NO smoke test needed** — this session makes NO changes to `*.module.ts`, `@Inject()`, or database schema.

---

## 5. Acceptance Criteria

- [ ] `apiClient` has 4 notification methods: `listNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`
- [ ] SSE client includes `notification.created` event type
- [ ] `useNotifications` hook fetches, polls, and handles SSE updates
- [ ] `NotificationBell` component renders in the header with real unread count from API
- [ ] Badge shows unread count (0 = hidden, 1-99 = number, 100+ = "99+")
- [ ] Clicking bell opens dropdown with notification list
- [ ] Each notification shows category icon + title + relative time
- [ ] Unread notifications have visual distinction (bold + accent border)
- [ ] Clicking a notification marks it as read and navigates to the related entity
- [ ] "Mark all as read" button works and resets badge to 0
- [ ] Clicking outside the dropdown closes it
- [ ] SSE `notification.created` event updates the badge count in real-time without page refresh
- [ ] Empty state shows when no notifications exist
- [ ] `npm run build` (frontend) passes
- [ ] Backend tests still pass (455 tests)
- [ ] All Vietnamese text comes from `constants.ts`, no hardcoded strings
- [ ] Session handoff updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: Notification bell + dropdown fully implemented (API client + SSE + hook + component + CSS)
   - Found: {any surprises}
   - What's Next: "Session 19: Duplicate policy + reprocess" (Phase 2.B.1)

2. Update `.context/agent-notes.md`:
   - Progress counters
   - Any new learned rules

3. Update `tasks/progress.md`:
   - Mark Session 18 / 2.A.3 as ✅ Done

**Next session depends on**: Session 18's notification bell being functional (real-time badge updates, click-to-navigate). Session 19 (duplicate policy) will create `duplicate_detected` notifications that should appear in the bell.
