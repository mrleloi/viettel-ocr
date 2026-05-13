# Session 27 Memory — Queue Upgrade + Phase 3 Planning

> Project: viettel-ocr (invoice processing tool, NestJS + Next.js + Gemini)
> Date: 2026-04-15
> Wing suggestion: `viettel-ocr`
> Categories: decisions, milestones, problems, code-patterns

---

## Key decisions

### D1 — Dual-backend queue with shared rate limiter

**Decision**: Keep SQLite-backed queue as default (zero-dep); add BullMQ/Redis as opt-in via `QUEUE_BACKEND=redis`. Share a single token-bucket `RateLimiter` across both backends for outbound Gemini calls.

**Rationale**: Avoid forcing Redis on small deployments but unlock real concurrency for batch workloads. One rate limiter guarantees Gemini QPS is respected regardless of backend choice.

**Config** (`invoice-tool/config.env`):
```
QUEUE_BACKEND=memory     # or 'redis'
QUEUE_CONCURRENCY=8
QUEUE_POLL_INTERVAL_MS=500
QUEUE_MAX_ATTEMPTS=3
QUEUE_RATE_LIMIT_PER_MINUTE=60
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=4
REDIS_KEY_PREFIX=viettel_ocr
```

### D2 — Fire-and-forget concurrency in memory worker

**Decision**: In `QueueWorkerService.poll()`, claim `slotsAvailable = concurrency - inFlight` jobs per cycle and dispatch each with `this.inFlight++; void this.processJob(job).finally(() => this.inFlight--)`. Do NOT await.

**Consequence**: tests need `await sut.waitForIdle(timeoutMs)` after `await sut.poll()` because jobs complete asynchronously.

### D3 — Both workers registered unconditionally, gated by `enabled`

**Decision**: Register `QueueWorkerService` AND `BullMQWorkerService` in DI regardless of backend. Each takes an `enabled` boolean; the disabled one skips `onModuleInit`. This keeps the `QueueController` able to inject both and pick metrics at request time.

### D4 — Idempotent enqueue

**Decision**: `SqliteJobQueue.enqueue()` checks for existing pending/processing job for the invoice and returns its ID if found (no new row). Prevents double-processing when uploads retry.

### D5 — Phase 3 theme: debuggable, steerable, configurable

User quote: *"now enhance the pipeline tab content, will need to be very useful to tracking, every time do process (upload/rerun/retry...), status, time, time range, log, etc... willing to be configurable 'workflow pipeline' after this phase. something like, 'when' - 'then', 'condition', 'match' - then, ... with summarize (extentable UI/UX to see detailed steps, logs...). => both use ful for end client, who upload file, and maintainer, who config/settings. i also need to be able to do more with 'review item', cancel it, delete it, more 'power/permission' with the result from ai result. the other thing matter is ability to 'intervent' the ai, like 'edit the ai prompt' (then do the re-run), or if ai response is not correct (still wrong after rerun) human able to manual edit the review detail, every information that created by ai could be edit again by human. not just prompt (review item level - prompt, and template level - prompt)"*

**Distilled into 4 requirements**:
- R1 Pipeline tab → live run log (new `ProcessingRun` entity; per-stage timestamps, attempt counter, raw I/O, logs)
- R2 Review item power (cancel, soft-delete, bulk ops, minimal role gating)
- R3 AI intervention (schema-level prompt versions + override; per-run prompt rerun; every AI field editable with audit trail)
- R4 Workflow rules MVP (AST: 5 when predicates × 5 then actions)

### D6 — Prompt storage model

**Decision**: `schema_prompt_versions` table tracks versions per schema. `schemas.active_prompt_version_id` FK picks the active one. `processing_runs.prompt_version_id` snapshots which version was used; `processing_runs.prompt_override` stores one-off overrides (capped at 16 KB).

### D7 — Rule engine AST (locked scope)

**Decision**: To prevent DSL rabbit hole, lock AST to:
- `when`: `stage`, `status`, `confidenceLt`, `confidenceGt`, `fieldMatch({key, op:'eq'|'regex', value})`
- `then`: `route_to_queue`, `auto_approve`, `auto_reject`, `set_flag`, `notify`

Anything else deferred to Phase 4.

### D8 — Soft-delete semantics

**Decision**: `Invoice.softDelete()` allowed from rejected/cancelled/approved_and_exported. Sets `deletedAt`. Default repo queries filter out deleted rows; maintainer views use `findAllIncludingDeleted()`. Exports MUST filter `deletedAt IS NULL`.

---

## Milestones

- **M1**: 543/543 backend tests green after queue rewrite.
- **M2**: TypeScript clean across full queue + controller changes.
- **M3**: Server boots with `Queue worker started (backend=memory concurrency=8 poll=500ms)` and route `GET /api/queue/metrics` mapped.
- **M4**: Smoke test PASSED (16s boot).
- **M5**: Phase 3 requirements doc + master plan written (`tasks/10-phase3-requirements.md`, `tasks/11-phase3-master-plan.md`).

---

## Problems solved

### P1 — Line item `amount` ~10% off
**Cause**: AI read the VAT-inclusive column instead of raw amount.
**Fix**: In mapper, sanity-check `|amount - qty*unit_price|`. If relative diff > 1%, recompute from `qty * unit_price`.

### P2 — AI response envelope `{ "fields": {...} }`
**Cause**: Gemini wraps payload inconsistently.
**Fix**: `readRaw()` unwraps `fields` envelope before key lookup.

### P3 — Fingerprint rules never matched post-extraction
**Cause**: Only ran fingerprint pass against raw OCR text, missing structured fields.
**Fix**: Second fingerprint pass after extraction. Confidence weights redistributed: hint 30 / fingerprint 25 / extraction 25 / validation 10 / mapping 10. When no hint exists, hint's 30% weight redistributes proportionally to the other signals.

### P4 — Stuck `processing` invoices after crash
**Cause**: Domain invariant rejected `pending → processing` when status was already `processing` (no retry path).
**Fix**: Dual recovery —
1. `Invoice.markAsProcessing` now allows `pending | processing` (crash-retry);
2. Startup sweep in `BullMQWorkerService.onModuleInit` resets orphaned `processing` rows to `pending` and re-enqueues.

Test updated to: `should allow re-entering processing (crash-recovery retry)` + new test for terminal status (`error`) throwing.

### P5 — Gemini 503 storm killed pipeline
**Fix**: 3× retry with exponential backoff on 429/503; 2× retry on other 5xx. `classifyWithLLM` wrapped in its own try/catch (non-fatal — classification falls back to schema hint if LLM fails). Rate limiter acquires token at top of each retry attempt.

### P6 — Export download saved with UUID filename
**Fix**: Controller sets `Content-Disposition: attachment; filename="..."` with meaningful name (`{schema-slug}_{supplier-slug}_{timestamp}.xlsx`). Vietnamese diacritics stripped for filename safety.

### P7 — DI token mismatch for `ProcessInvoiceUseCase`
**Cause**: Queue module was injecting string `'ProcessInvoiceUseCase'` but `ApplicationModule` registers it by class reference.
**Fix**: Use class reference `ProcessInvoiceUseCase` in all `inject:` arrays.

### P8 — `InterfaceModule` couldn't access QueueController deps
**Cause**: `InterfaceModule` imported `ApplicationModule` only; NestJS imports are not transitive.
**Fix**: Explicitly `imports: [ApplicationModule, FileStorageModule, QueueModule]`.

---

## Code patterns (reusable)

### Token-bucket rate limiter
```typescript
// src/infrastructure/queue/rate-limiter.service.ts
@Injectable()
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillMs: number;  // ms per token

  constructor(private readonly maxPerMinute: number) {
    this.capacity = maxPerMinute;
    this.tokens = maxPerMinute;
    this.refillMs = maxPerMinute > 0 ? 60000 / maxPerMinute : 0;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    if (this.maxPerMinute <= 0) return; // disabled
    while (true) {
      this.refill();
      if (this.tokens >= 1) { this.tokens -= 1; return; }
      await new Promise(r => setTimeout(r, this.refillMs));
    }
  }

  availableTokens(): number { this.refill(); return Math.floor(this.tokens); }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const gained = elapsed / this.refillMs;
    this.tokens = Math.min(this.capacity, this.tokens + gained);
    this.lastRefill = now;
  }
}
```

### Fire-and-forget concurrent dispatch
```typescript
// inside QueueWorkerService.poll()
const slots = this.concurrency - this.inFlight;
if (slots <= 0) return;
const jobs = await this.queue.takePending(slots);
for (const job of jobs) {
  this.inFlight++;
  void this.processJob(job).finally(() => { this.inFlight--; });
}
```

### Structured job log
```
[ok] job=abc123 inv=inv-456 attempt=1/3 dur=2341ms inflight=3/8
[fail] job=abc124 inv=inv-457 attempt=2/3 dur=5122ms inflight=2/8 err="Gemini 503"
```

### Percentile metrics
```typescript
// QueueWorkerService keeps a ring buffer of last 100 durations
getMetrics(): QueueMetrics {
  const sorted = [...this.durations].sort((a,b) => a-b);
  return {
    backend: 'memory',
    inFlight: this.inFlight,
    completed: this.completed,
    failed: this.failed,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
  };
}
```

### Idempotent enqueue
```typescript
// SqliteJobQueue.enqueue
async enqueue(invoiceId: string): Promise<string> {
  const existing = await this.db.select().from(jobs)
    .where(and(eq(jobs.invoiceId, invoiceId), inArray(jobs.status, ['pending','processing'])))
    .limit(1);
  if (existing.length) return existing[0].id;
  // ...insert new row
}
```

---

## Stack facts (pinned)

- NestJS 10 + Drizzle ORM + SQLite (better-sqlite3)
- BullMQ 5.74.1 + ioredis 5.10.1
- Next.js 14 + React 19 + Tailwind + shadcn/ui
- Gemini Flash API
- OS: Windows 11, PowerShell — bash syntax does NOT work (use `;` not `&&` in PS)
- Backend package path: `invoice-tool/packages/backend`
- Always run jest FROM `packages/backend`, NEVER from monorepo root
- Phase 2 test baseline: 543 tests. Phase 3 DOD: ≥ 620.

---

## Architecture invariants (Phase 3 must preserve)

- `domain/` imports ZERO from `@nestjs/*` or `infrastructure/`
- Repository interfaces live in `domain/{context}/`, impls in `infrastructure/database/repositories/`
- NestJS DI token for repo: `@Inject('I{Entity}Repository')`
- Notifications MUST go through event bus emit, not direct repo calls
- Red-Green-Refactor commit sequence: `test:` → `feat:` → `refactor:`
- OpenAPI spec is the FE-BE contract — generated, not handwritten
