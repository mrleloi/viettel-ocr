# Phase 3 Requirements — Observability, Intervention & Workflow Config

> Version: 3.0
> Date: 2026-04-15
> Status: Planning
> Predecessor: `tasks/09-phase2-master-plan.md` (Phase 2 depth — complete)

---

## 0. Context

Phase 2 closed the breadth-vs-depth gap: every sidebar tab now has real behavior (notifications, reprocess, duplicate policy, schema wizard with sample preview, filtered exports). Phase 3 reacts to three new realities uncovered while running real batches on Phase 2:

1. **Throughput stress** — users are uploading dozens of invoices at a time. The job queue, originally sized for ~1 concurrent worker, now needs real concurrency, Redis-backed scaling, rate limiting, and metrics. (Mostly done this session — see §2.)
2. **Observability gap** — when something goes wrong (low confidence, AI misread, 503 retry), the operator cannot see *what happened when*. The Pipeline tab today shows a static trace, not a living log.
3. **AI fallibility** — the LLM is wrong often enough that humans need first-class tools to *intervene*: edit a prompt and re-run, override AI-extracted fields, cancel/delete bad work. Currently the UI only allows approve/reject/edit-field — not prompt editing, not cancel, not delete.

Phase 3 is one coherent theme: **"make the tool debuggable, steerable, and configurable by a human operator."**

---

## 1. Completed in this session (Session 27, pre-plan)

Before Phase 3 formally begins, the following hardening work was completed directly (and is NOT re-listed in the session plan). It is captured here so the plan document reflects the true starting state.

### 1.1 Bug fixes (review pipeline)

| # | Bug | Fix | Verified on |
|---|-----|-----|-------------|
| a | Line items rendered with wrong amounts (~10% off — VAT column read instead of raw amount) | Mapper sanity-check recomputes `amount` when `|amount - qty*unit_price| > 1%` | inv `27793e89`, `787a61e6` |
| b | AI returned `item_name`/`item_quantity`/`item_unit_price` instead of schema keys | Added alias-map in LineItemMapper (`item_*` → schema keys) | inv `63d6b278` |
| c | AI response wrapped in `"fields": {...}` envelope | `readRaw()` unwraps envelope before indexing | inv `63d6b278` |
| d | Invalid VAT rate "10%" string rejected by domain VO | Normalize to number, strip `%`, coerce `"10"`→10 before VO construct | multiple |
| e | Fingerprint rules not re-evaluated after extraction (always matched on OCR only) | Added second fingerprint pass post-extraction; confidence redistributed (hint 30 / fp 25 / extract 25 / valid 10 / map 10) | confidence > 60% now reachable |
| f | Invoices stuck in `processing` after app crash | Dual recovery: domain `markAsProcessing` accepts from `processing` (retry); startup sweep resets orphaned rows to `pending` | app-restart smoke |
| g | Gemini 503 cascade killed whole pipeline | Wrap `classifyWithLLM` in own try/catch (non-fatal); 3× retry with exp backoff on 429/503, 2× on other 5xx | 503 storm |

### 1.2 Export UX

| # | Change |
|---|--------|
| a | Export filename now includes schema slug + supplier slug + timestamp (Vietnamese diacritics stripped) |
| b | Download endpoint sets `Content-Disposition: attachment; filename="..."` so browser saves with the meaningful name, not the UUID |

### 1.3 Queue upgrade (Redis/BullMQ optional)

Full replacement of the single-worker polling queue with a dual-backend system. Default stays SQLite-backed (zero external deps); Redis backend opt-in via env var.

**Config** (`invoice-tool/config.env`, `env-config.service.ts`):
```
QUEUE_BACKEND=memory            # or 'redis'
QUEUE_CONCURRENCY=8
QUEUE_POLL_INTERVAL_MS=500
QUEUE_MAX_ATTEMPTS=3
QUEUE_RATE_LIMIT_PER_MINUTE=60
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=4
REDIS_KEY_PREFIX=viettel_ocr
```

**New files:**
- `infrastructure/queue/rate-limiter.service.ts` — token-bucket shared across both backends; blocks `acquire()` until token available; `availableTokens()` for observability
- `infrastructure/queue/bullmq-job-queue.service.ts` — `IJobQueue` impl over BullMQ `Queue`; jobId `inv-{id}-{ts}`; `countPending()` sums waiting+delayed+paused
- `infrastructure/queue/bullmq-worker.service.ts` — wraps BullMQ `Worker`; crash recovery on init (resets `processing` rows, re-enqueues `pending`); completed/failed/error listeners; `enabled` flag to skip when backend ≠ redis
- `interface/http/queue.controller.ts` — `GET /api/queue/metrics` returns `{ backend, metrics (in-flight, completed, failed, p50/p95 duration), pending, rateLimit, config }`

**Rewritten files:**
- `infrastructure/queue/queue-worker.service.ts` — fire-and-forget concurrent dispatch (`inFlight++; void this.processJob(job).finally(() => inFlight--)`); p50/p95 metrics; `waitForIdle(timeoutMs)` test helper; `enabled` flag; structured log line per job
- `infrastructure/queue/queue.module.ts` — factory-based DI; both workers registered unconditionally but gated by `enabled`; shared rate limiter
- `infrastructure/queue/sqlite-job-queue.service.ts` — `enqueue()` now idempotent: returns existing job id if invoice already has pending/processing job
- `infrastructure/ai/gemini.client.ts` — `@Optional()` rate-limiter injected; `await rateLimiter.acquire()` at top of each retry attempt

**Verification** (this session):
- `tsc --noEmit` clean
- 543 / 543 tests pass
- Server boots: `QueueModule dependencies initialized`, `QueueController {/api/queue}`, route `GET /api/queue/metrics` mapped, `Queue worker started (backend=memory concurrency=8 poll=500ms)`
- Smoke test PASSED (16s boot)

This work is DONE. Phase 3 starts from here.

---

## 2. New requirements (Phase 3 scope)

### R1 — Pipeline tab becomes a living run log

**Today**: Review detail's "Pipeline" tab shows a static list of pipeline stages (OCR, classify, extract, validate, map) with durations — rendered from `invoice.traces`. It tells you *what happened* but not *when, how long, or whether anything retried*.

**Required** (end-user + maintainer view):

| Capability | End-user needs | Maintainer needs |
|---|---|---|
| Per-invoice timeline with absolute timestamps | ✅ | ✅ |
| Per-stage `started_at`, `finished_at`, `duration_ms` | ✅ | ✅ |
| Attempt number (1/3) on retries | ✅ | ✅ |
| Event stream: `upload`, `enqueued`, `claimed`, `stage_started`, `stage_finished`, `stage_failed`, `retry_scheduled`, `completed`, `rerun_triggered`, `approved`, `rejected`, `edited_by_human`, `cancelled`, `deleted` | Summary | Full detail |
| Expandable row → raw logs / payload / AI prompt used / AI raw response | On demand | Always-on |
| Time-range filter (today / 24h / 7d / custom) on the listing view | ✅ | ✅ |
| Batch-level pipeline view (all invoices in a batch, grouped by stage) | ✅ | ✅ |
| System-wide pipeline view at `/diagnostics` (all runs, filterable by status/user/schema) | — | ✅ |

**New domain concept**: `ProcessingRun` (a single run of the pipeline for one invoice). One invoice can have *N* runs (upload → rerun → retry-after-fail). Current `traces` table stores stages-within-a-run; we need a run-level envelope.

**Schema additions** (Drizzle):
```sql
CREATE TABLE processing_runs (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  run_number INTEGER NOT NULL,              -- 1, 2, 3... (per invoice)
  trigger TEXT NOT NULL,                    -- 'upload' | 'rerun' | 'retry_after_fail' | 'prompt_edit_rerun'
  triggered_by TEXT,                        -- user id or 'system'
  schema_id TEXT REFERENCES schemas(id),    -- snapshot — schema may change across runs
  prompt_version_id TEXT,                   -- see R3
  status TEXT NOT NULL,                     -- 'running' | 'succeeded' | 'failed' | 'cancelled'
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

-- extend existing traces table
ALTER TABLE invoice_traces ADD COLUMN run_id TEXT REFERENCES processing_runs(id);
ALTER TABLE invoice_traces ADD COLUMN attempt INTEGER DEFAULT 1;
ALTER TABLE invoice_traces ADD COLUMN raw_input TEXT;         -- JSON (e.g. prompt sent to Gemini)
ALTER TABLE invoice_traces ADD COLUMN raw_output TEXT;        -- JSON (e.g. Gemini raw response)
ALTER TABLE invoice_traces ADD COLUMN log TEXT;               -- freeform log lines from the stage
```

**API additions**:
- `GET /api/invoices/:id/runs` → list runs for invoice
- `GET /api/runs/:runId` → full run detail (stages + logs + raw io)
- `GET /api/runs?since=...&until=...&status=...&schemaId=...` → system-wide timeline (Diagnostics)

**Frontend**:
- Rewrite `TraceTimeline.tsx` → `RunTimeline.tsx` with expandable per-stage rows
- New `app/diagnostics/runs/page.tsx` — run listing with filters
- Batch detail page gets a "Pipeline" tab mirroring the per-run view

---

### R2 — Review item power: cancel, delete, bulk ops

**Today**: Review detail has `approve`, `reject`, `edit-field` (save inline). No cancel (while processing), no delete (after reject), no bulk action.

**Required**:

| Action | When allowed | Effect | Permission gate |
|---|---|---|---|
| `cancel` | status = `pending` or `processing` | run → status `cancelled`; job removed from queue (BullMQ `remove()` or SQLite mark `cancelled`); invoice → `cancelled` | operator+ |
| `delete` | status = `rejected` or `cancelled` or `approved_and_exported` | soft-delete (invoice.deleted_at); PDF retained for N days then hard-deleted | maintainer only |
| `bulk_reject` | review list multi-select | N invoices → `rejected` with shared reason | operator+ |
| `bulk_rerun` | review list multi-select, status ∈ {`rejected`, `needs_review`, `cancelled`} | enqueue fresh run for each | operator+ |
| `bulk_delete` | review list multi-select, status = `rejected` | N soft-deletes | maintainer only |

**Domain**: `Invoice.cancel()`, `Invoice.softDelete()`, invariant `cannot cancel terminal status`.

**API**:
- `POST /api/invoices/:id/cancel`
- `DELETE /api/invoices/:id` (soft)
- `POST /api/invoices/bulk` → `{ action, ids[], reason? }`

**Frontend**:
- Review detail: three-dot menu with "Cancel" / "Delete" when gated
- Review list: checkbox column, sticky bulk-action bar

**Permissions** (new — Phase 3 introduces minimal RBAC):
Until now the app has been single-tenant + trust-based. Phase 3 introduces three roles: `viewer`, `operator`, `maintainer`. Wire only the bare-minimum guard (header `X-Role`) — full auth is out of scope.

---

### R3 — AI intervention: prompt editing & human override

**Today**: Prompts are generated by `PromptBuilderService` from schema field definitions and are **not visible** to the user. The only human override is inline field editing in the review screen.

**Required — two levels of intervention:**

#### R3a — Template-level (schema prompt)

Per-schema "AI prompt" that maintainers can edit. When schema is used, the generated prompt is merged with the custom prompt (or fully replaced, user choice).

- Schema edit page gets "AI Prompt" panel with:
  - Default prompt preview (read-only, shows what the builder would generate)
  - Custom prompt textarea (override or prepend, toggle)
  - "Test prompt on sample" button → uses existing `PreviewSchemaExtractionUseCase`
  - Versioned on save → `schema_prompt_versions` table
- Schema has `active_prompt_version_id` → used for all new runs
- Run carries snapshot `prompt_version_id` so old runs are re-playable

#### R3b — Review-item-level (one-off rerun with edited prompt)

On review detail, when AI is wrong:
1. "Edit & rerun" button on a field (or on the whole extraction)
2. Modal shows: the *exact* prompt that was used for this run + the AI's raw response + a diff of what was extracted vs. what's wrong
3. Operator edits the prompt (one-off, not saved to schema) → "Rerun with this prompt"
4. System enqueues a fresh run with `trigger='prompt_edit_rerun'` and `prompt_override` stored on the run
5. New run's results replace the visible extraction; old run is archived (visible in run history)

#### R3c — Everything AI-generated is human-editable

Audit pass: every field the AI writes should have an inline edit UI on the review page. Today covered:
- ✅ Supplier tax id, invoice number, date, total — editable
- ✅ Line item description, quantity, unit price — editable (inline in table)

**Not yet editable — add in Phase 3**:
- Classification (schema chosen by AI) — dropdown to re-pick schema, triggers rerun with the new schema
- Confidence score breakdown — editable by maintainer (audit trail)
- Validation result — maintainer can mark "false positive, ignore" on a validation error
- Mapping decision — operator can override AI-chosen product mapping inline

All human edits are tracked in `invoice_edits` (who / when / field / before / after).

---

### R4 — Workflow pipeline (configurable "when-then")

**Today**: Pipeline is hard-coded: `ocr → classify → extract → validate → score → map → export`. Cannot branch.

**Required** (MVP — intentionally small):
A minimal rule engine attached to the pipeline. Maintainer defines rules like:

```yaml
rules:
  - when: stage = "classify" and confidence < 0.5
    then: route_to_queue("manual-classification")
  - when: stage = "validate" and errors contains "vat_rate_invalid"
    then: auto_fix("vat_rate", normalize_vat)
  - when: stage = "extract" and supplier_tax_id matches /^01\d{9}$/
    then: set_schema("viettel-standard-v2")
  - when: stage = "completed" and confidence > 0.9
    then: auto_approve
```

**MVP subset** (Phase 3 ships only these):
- `when` clauses: `stage`, `status`, `confidence`, simple field match (equality, regex)
- `then` clauses: `route_to_queue(name)`, `auto_approve`, `auto_reject(reason)`, `set_flag(key, value)`, `notify(category)`

Anything more complex (arbitrary JS, multi-step then, chained rules) is out of scope — captured in "Phase 4 ideas" below.

**Schema**:
```sql
CREATE TABLE pipeline_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,
  when_expr TEXT NOT NULL,           -- JSON — AST of when clause
  then_expr TEXT NOT NULL,           -- JSON — AST of then clause
  applies_to_schema_id TEXT,         -- null = global
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pipeline_rule_firings (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES pipeline_rules(id),
  run_id TEXT NOT NULL REFERENCES processing_runs(id),
  invoice_id TEXT NOT NULL,
  fired_at INTEGER NOT NULL,
  outcome TEXT                       -- 'applied' | 'skipped' | 'error'
);
```

**UI**: New settings page `/settings/pipeline-rules` — list + create + toggle + test-on-invoice.

---

## 3. Non-goals (explicitly deferred)

- Multi-tenant auth / SSO — stays single-tenant
- Visual no-code workflow builder (drag-and-drop) — text-form rules only
- Real-time collaboration on review — single-editor-at-a-time
- Prompt A/B testing infra — single active version per schema
- Historical replay of old runs with new prompt — stored but not replayable automatically
- GPU / self-hosted LLM — Gemini API stays the only backend

---

## 4. Phase 3 DOD

- Pipeline tab shows live run with absolute timestamps, retries, expandable raw I/O
- Operator can cancel an in-flight invoice and delete a rejected one
- Maintainer can edit a schema's AI prompt, save as version, test on sample
- Operator can edit prompt for one invoice and trigger a rerun
- Every AI-generated field is editable with audit trail
- At least 3 sample pipeline rules ship and fire on test data
- Backend tests ≥ 620 (from 543)
- Smoke-test green, frontend typecheck green

See `tasks/11-phase3-master-plan.md` for the session-by-session breakdown.
