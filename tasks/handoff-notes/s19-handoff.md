# Session 19 Handoff — Duplicate Policy + Reprocess

> Date: 2026-04-08 | Tests: 477 (was 455, +22) | All green ✅

## What Was Done

### Domain Layer
- **`Invoice.resumeForReprocess()`** — New state transition allowing terminal-state invoices (`approved`, `rejected`, `error`, `duplicate`) to reset to `pending`. Wipes all extracted data, confidence scores, and processing timestamps while preserving identity (ID, batch, filename).
- **BDD tests**: 8 new tests covering all terminal states, invalid transitions from non-terminal states, and data wiping verification.

### Application Layer
- **`ReprocessInvoiceUseCase`** — Orchestrates invoice reprocessing: validates existence, calls domain transition, saves to repo, enqueues for pipeline, emits notification. Uses `@Optional()` DI for CreateNotificationUseCase.
- **`DuplicatePolicy` type** (`skip` | `process_anyway` | `flag_only`) — Added to `UploadBatchInput`. The upload flow now respects this policy:
  - `skip` (default): Mark as duplicate, don't process
  - `process_anyway`: Reset existing invoice via `resumeForReprocess()` and re-enqueue
  - `flag_only`: Mark as duplicate (same as skip, with notification)
- **BDD tests**: 7 reprocess tests + 3 duplicate policy tests = 10 new application tests.

### Interface Layer
- **`POST /api/invoices/:id/reprocess`** — New endpoint in InvoiceController
- **`CreateBatchDto.onDuplicate`** — Optional field with Swagger docs and enum validation
- **BatchController** — Passes `onDuplicate` through to use case
- **E2E test** — Updated to include ReprocessInvoiceUseCase mock
- **Controller test** — New reprocess endpoint test case

### Frontend
- **Upload page** — Radio group for duplicate policy selection (3 options with Vietnamese labels)
- **Review detail page** — "Xử lý lại" (Reprocess) button shown for terminal-state invoices
- **API client** — `reprocessInvoice()` method + `onDuplicate` param in `uploadBatch()`
- **CSS** — `.radio-group` and `.radio-option` styles with dark theme integration
- **Constants** — Vietnamese labels for all new UI strings

## Files Modified

### Backend
- `domain/invoice/invoice.entity.ts` — `resumeForReprocess()` method
- `domain/invoice/__tests__/invoice.entity.spec.ts` — 8 new domain tests
- `application/processing/reprocess-invoice.use-case.ts` — NEW
- `application/processing/__tests__/reprocess-invoice.use-case.spec.ts` — NEW (7 tests)
- `application/upload/upload-batch.use-case.ts` — `DuplicatePolicy` type + policy handling
- `application/upload/__tests__/upload-batch.use-case.spec.ts` — 3 new policy tests
- `application/application.module.ts` — Registered ReprocessInvoiceUseCase
- `interface/http/invoice.controller.ts` — Reprocess endpoint + DI
- `interface/http/dto/create-batch.dto.ts` — `onDuplicate` field
- `interface/http/batch.controller.ts` — Pass `onDuplicate` to use case
- `interface/http/__tests__/invoice.controller.spec.ts` — Reprocess test
- `__tests__/e2e/full-flow.e2e.spec.ts` — Updated DI providers

### Frontend
- `lib/constants.ts` — Vietnamese labels for policy + reprocess
- `lib/api-client.ts` — `reprocessInvoice()` + `onDuplicate` param
- `app/upload/page.tsx` — Duplicate policy radio group
- `app/review/[id]/page.tsx` — Reprocess button + handler
- `app/globals.css` — Radio group styles

## Quality Gates Passed
- ✅ 477/477 tests pass (55 suites)
- ✅ TypeScript compiles cleanly (`tsc --noEmit`)
- ✅ Frontend builds (`next build`)
- ✅ No lint errors in modified files

## Lessons Learned
1. **NotificationCategory is a strict union** — must use values from `NOTIFICATION_CATEGORIES` array, not arbitrary strings like `processing_started`
2. **E2E tests bootstrap controllers directly** — when adding new controller dependencies, the E2E test module must also provide them
3. **`import type` vs `import`** — when using `Invoice.reconstitute()` in tests, must use value import not type-only import

## Next Session (20)
**Focus**: Invoice DTO expansion + file/trace endpoints (Issue #6)
- Expand InvoiceResponseDto with all missing fields (lineItems, fieldConfidences, ocrRawText, etc.)
- Add `GET /api/invoices/:id/file` endpoint to serve the original PDF
- Add `GET /api/invoices/:id/traces` for processing trace data
- Update frontend API client types accordingly
