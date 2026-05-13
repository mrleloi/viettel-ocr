# Master Plan — Phase 3 (Observability, Intervention & Workflow)

> Version: 3.0
> Date: 2026-04-15
> Status: Planning
> Requirements: `tasks/10-phase3-requirements.md`
> Predecessor: `tasks/09-phase2-master-plan.md`

---

## 0. Theme

Make the tool **debuggable, steerable, and configurable** by a human operator. Three pillars: live pipeline tracing, human intervention points, minimal workflow rule engine.

---

## 1. Session map (sessions 28–37)

| # | Session | Scope | Output | Tests delta |
|---|---------|-------|--------|-------------|
| 28 | **Run-envelope domain & schema** | `ProcessingRun` entity, repo, migration; `traces` gets `run_id`, `attempt`, `raw_input`, `raw_output`, `log` | `processing_runs` table, `ProcessingRun` entity + 15 domain tests | +15 |
| 29 | **Run recording + API** | Wire `ProcessInvoiceUseCase` to create a run on each invocation; stage hooks append traces; `GET /api/invoices/:id/runs`, `GET /api/runs/:id` | Controller + 2 use cases + 12 tests | +12 |
| 30 | **Pipeline tab rewrite (frontend)** | `RunTimeline` with expandable rows, stage timestamps, attempt badges, raw I/O viewer | `RunTimeline.tsx`, run detail modal, review page integration | — |
| 31 | **Diagnostics runs view** | `/diagnostics/runs` page — system-wide timeline with filters (status, schema, time range) | Page + list endpoint `GET /api/runs?since=...` | +8 |
| 32 | **Cancel & delete (domain + API)** | `Invoice.cancel()`, `Invoice.softDelete()`, bulk endpoint `POST /api/invoices/bulk` | Use cases + controller + 18 tests | +18 |
| 33 | **Cancel & delete (frontend)** | Review detail three-dot menu; review list multi-select + sticky bulk-action bar | UI only | — |
| 34 | **Prompt versioning (schema level)** | `schema_prompt_versions` table, Schema entity gets `activePromptVersionId`, API to list/create/activate | 3 use cases + controller + 14 tests | +14 |
| 35 | **Prompt editor UI + test-on-sample** | Schema edit page "AI Prompt" panel; reuse `PreviewSchemaExtractionUseCase` for test | UI + wiring | +4 |
| 36 | **Per-run prompt override (rerun flow)** | `ReprocessInvoiceUseCase` accepts `promptOverride`; new run snapshots it; review detail "Edit & rerun" modal | Use case update + modal component + 10 tests | +10 |
| 37 | **Expand human override coverage** | Classification re-pick, validation "false positive", mapping override — all tracked in `invoice_edits` | Frontend polish + 8 tests | +8 |
| 38 | **Pipeline rules MVP (domain + eval)** | `PipelineRule` entity, `RuleEvaluatorService` (when/then AST), `pipeline_rules` + `pipeline_rule_firings` tables | Entity + service + 20 tests | +20 |
| 39 | **Rules integration into pipeline** | Evaluator invoked at stage-end hooks in `ProcessInvoiceUseCase`; fires tracked; at least 3 seed rules | Wiring + seed rules + 10 tests | +10 |
| 40 | **Rules management UI** | `/settings/pipeline-rules` list/create/toggle/test-on-invoice | Page + forms | +4 |
| 41 | **Phase 3 polish + DOD gate** | Frontend regressions, empty states, typecheck, smoke, test count ≥ 620 | — | — |

Running total: 543 → ~666 tests.

---

## 2. Dependencies & order

```
S28 (run domain) ──► S29 (run API) ──► S30 (pipeline UI) ──► S31 (diagnostics)
                                  └──► S36 (prompt rerun needs run-id)

S32 (cancel/delete API) ──► S33 (cancel/delete UI)

S34 (prompt versions) ──► S35 (prompt editor UI) ──► S36 (per-run override)

S37 (override coverage) can slot anywhere after S33.

S38 (rule domain) ──► S39 (rule integration) ──► S40 (rule UI)
S38 depends on S28 (rules fire on run events).

S41 runs last.
```

Critical path: **S28 → S29 → S36 → S39 → S41**. Parallelizable: S30, S31, S33, S35, S37, S40.

---

## 3. Per-session detail

### Session 28 — Run-envelope domain & schema

**Goal**: introduce `ProcessingRun` without changing any existing behavior (adapter pattern: current pipeline wraps itself in a run retroactively on first invocation).

**Steps**:
1. Add `processing_runs` table to `infrastructure/database/schema.ts` + `initializeTables()` in `connection.ts` + `createTestDb()`.
2. Add ALTER TABLE for `invoice_traces` columns (`run_id`, `attempt`, `raw_input`, `raw_output`, `log`) — wrapped in try/catch per architecture rule.
3. `domain/processing/processing-run.entity.ts`:
   - `static create({ invoiceId, runNumber, trigger, triggeredBy, schemaId, promptVersionId })`
   - `static reconstitute(...)` for hydration
   - `startStage(stage)`, `finishStage(stage, durationMs)`, `markFailed(err)`, `markSucceeded()`, `markCancelled()`
   - Invariants: only running → succeeded/failed/cancelled; cannot finishStage before startStage
4. `domain/processing/processing-run.repository.ts` interface.
5. Drizzle impl in `infrastructure/database/repositories/`.
6. Tests: 15 specs in `processing-run.entity.spec.ts` covering transitions.

**Commit plan** (RGR):
- `test: add specs for ProcessingRun entity` (15 failing)
- `feat: implement ProcessingRun entity + repo`
- `feat: migrate processing_runs table`
- `refactor: unify run/trace ID generation`

---

### Session 29 — Run recording + API

**Goal**: every `ProcessInvoiceUseCase.execute()` creates a run, appends stage traces, marks it at the end.

**Steps**:
1. Inject `IProcessingRunRepository` into `ProcessInvoiceUseCase`.
2. At top: create run (`run_number = existingRuns.length + 1`, `trigger = 'upload' | 'rerun' | 'retry_after_fail'`).
3. At each stage boundary: `run.startStage(x)` / `run.finishStage(x, dur)`, append trace with `run_id` + `attempt`.
4. At end: `run.markSucceeded()` (or `markFailed` on catch).
5. Retry path (queue worker): when claim is attempt N, trace gets `attempt=N`; new run is NOT created — same run spans retries.
6. New controllers: `InvoiceController.getRuns(id)`, `RunController.get(runId)`.
7. Tests: use case creates run, 2nd execute creates run #2, retry reuses run.

---

### Session 30 — Pipeline tab rewrite (frontend)

**Goal**: Pipeline tab shows a list of runs (newest first), each expandable into stages, each stage expandable into raw I/O + logs.

**Components**:
- `RunTimeline.tsx` — vertical timeline, run cards
- `RunStageRow.tsx` — one stage; shows `started_at`, `finished_at`, `duration`, attempt badge, status dot
- `RunStageDetail.tsx` — collapsible: raw input (formatted JSON), raw output, log lines
- `ReviewRunHistory.tsx` — header bar "Run 3 of 3 (current) · Run 2 · Run 1"

**Integration**: replace `TraceTimeline` in `review/[id]/page.tsx`.

---

### Session 31 — Diagnostics runs view

**Goal**: one place to watch all runs across all invoices.

**Steps**:
1. `GET /api/runs?since&until&status&schemaId&invoiceId&limit&offset`.
2. `/diagnostics/runs/page.tsx` — filter bar + paginated table; row click → modal with same `RunStageDetail` component from S30.
3. Add "Runs" link to existing diagnostics page.
4. 8 controller tests (filter combinations, pagination).

---

### Session 32 — Cancel & delete (domain + API)

**Steps**:
1. `Invoice.cancel(reason)` — allowed from pending/processing; throws otherwise.
2. `Invoice.softDelete()` — allowed from rejected/cancelled/approved_and_exported; sets `deletedAt`.
3. `ProcessingRun.markCancelled()` — set when owning invoice is cancelled.
4. Queue: on cancel, call `queue.remove(invoiceId)` — add method to `IJobQueue` (both impls).
5. Use cases: `CancelInvoiceUseCase`, `DeleteInvoiceUseCase`, `BulkInvoiceActionUseCase`.
6. Repository: `findAll()` filters out `deletedAt != null` by default; new `findAllIncludingDeleted()` for maintainer views.
7. Tests: 18 specs.

---

### Session 33 — Cancel & delete (frontend)

**Steps**:
1. Review detail: three-dot menu component with confirm dialog for each destructive action.
2. Review list: `useReviewSelection` store (Zustand), checkbox column, sticky `BulkActionBar` component.
3. Role gating: `useRole()` hook reads `X-Role` (default `operator`); maintainer-only buttons hidden for operator.

---

### Session 34 — Prompt versioning (schema level)

**Schema**:
```sql
CREATE TABLE schema_prompt_versions (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schemas(id),
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,                 -- full prompt text OR prepend-fragment
  mode TEXT NOT NULL,                    -- 'override' | 'prepend'
  created_by TEXT,
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 0
);
-- schemas gains active_prompt_version_id (nullable; null = use PromptBuilder default)
```

**Use cases**: `CreatePromptVersionUseCase`, `ActivatePromptVersionUseCase`, `ListPromptVersionsUseCase`.

**PromptBuilder change**: accepts an optional `activeVersion` and either replaces or prepends.

---

### Session 35 — Prompt editor UI + test-on-sample

**Components**:
- `PromptEditorPanel.tsx` on schema edit page
- Left column: "Default prompt" (readonly, from builder)
- Right column: textarea + mode toggle
- "Test on sample" button → fires `PreviewSchemaExtractionUseCase` with override → shows extraction result
- "Save as new version" → creates version, prompts for activation

---

### Session 36 — Per-run prompt override (rerun flow)

**Changes**:
1. `ReprocessInvoiceUseCase` (Phase 2, session 19) gains optional `promptOverride: string`.
2. When present, new run's `prompt_version_id` is null and run carries `prompt_override` snapshot (new column on `processing_runs`).
3. PromptBuilder accepts an inline override.
4. Review detail: "Edit prompt & rerun" button on any AI-populated section.
5. Modal shows last run's prompt + AI response + editable prompt. On submit, call reprocess with override.
6. 10 specs.

---

### Session 37 — Expand human override coverage

**Scope**: every AI-written field gets a human edit UI; each edit writes to `invoice_edits`.

New edits:
- **Classification**: dropdown in header "Schema: X ▾" → re-pick → enqueue rerun with `trigger='classification_override'`.
- **Validation**: per-error "Dismiss (false positive)" → writes dismissal to `validation_dismissals`; score recomputes.
- **Mapping**: inline product picker per line item.

8 specs covering the audit trail.

---

### Session 38 — Pipeline rules MVP (domain + eval)

**Domain**:
- `PipelineRule.create({ name, when, then, priority, appliesTo })` validates AST.
- AST types (discriminated union):
  - `WhenClause`: `{ stage?, status?, confidenceLt?, confidenceGt?, fieldMatch?: { key, op: 'eq'|'regex', value } }`
  - `ThenClause`: `{ action: 'route_to_queue'|'auto_approve'|'auto_reject'|'set_flag'|'notify', params: {...} }`
- `RuleEvaluatorService.evaluate(rule, context)` returns `boolean`.
- `RuleEvaluatorService.applyThen(rule, context)` executes the action (injects use-case refs).

**Storage**: `pipeline_rules`, `pipeline_rule_firings`.

20 specs.

---

### Session 39 — Rules integration into pipeline

**Hook points** (in `ProcessInvoiceUseCase`):
- After `classify`: evaluate rules with `stage='classify'`
- After `validate`: evaluate with `stage='validate'`
- On `complete`: evaluate with `stage='completed'`

Seed rules (via migration):
1. `auto_approve` when `stage='completed' && confidence > 0.9`
2. `notify('low_confidence')` when `stage='completed' && confidence < 0.5`
3. `route_to_queue('vat_review')` when `stage='validate' && errors contains 'vat_rate_invalid'`

10 integration specs.

---

### Session 40 — Rules management UI

`/settings/pipeline-rules`:
- List table with enable/disable toggle
- Create/Edit form — guided "when" builder (stage dropdown, confidence slider) + "then" dropdown
- "Test on invoice" action → pick an invoice → dry-run evaluator → show what would fire

4 controller specs.

---

### Session 41 — Phase 3 polish + DOD gate

- Run all quality gates
- Verify test count ≥ 620
- Smoke-test green
- Screenshot each new UI for the DOD doc
- Update `progress.md`

---

## 4. Quality gates (unchanged from Phase 2)

- Gate 1: `tsc --noEmit` + `jest --bail` (backend), `tsc --noEmit` (frontend)
- Gate 1.5: smoke test on DI-touching sessions (28, 29, 32, 34, 36, 38, 39)
- Gate 2: architecture rules (domain → zero NestJS, repo interface in domain, etc.)
- Gate 3: Phase 3 DOD bullets in `10-phase3-requirements.md §4`

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Migrations on existing DB break dev environments | All ALTERs guarded; document `npm run db-reset` as escape hatch |
| Rule evaluator becomes a DSL rabbit hole | Lock AST to the 5 `then` actions listed; reject PRs adding new ones |
| Prompt override stored as blob grows unbounded | Cap at 16 KB per version; reject larger with domain error |
| Soft-delete leaks into exports | `ExportUseCase` must filter `deletedAt IS NULL` — add test at S32 |
| BullMQ `remove()` semantics differ from SQLite delete | S32 adds compatibility tests for both impls |

---

## 6. Phase 4 ideas (NOT in scope)

- Visual drag-drop rule builder
- Multi-step `then` chains
- Rule testing playground with synthetic invoices
- Prompt A/B testing
- Historical run replay with new prompt
- Multi-tenant auth + per-tenant rule sets
- Webhook `then` action (post to external URL on match)
