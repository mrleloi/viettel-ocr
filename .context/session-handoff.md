# Session Handoff

## Last Session: Session 8 — Remaining Application Use Cases
**Date**: 2026-04-07
**Status**: ✅ Complete

### What was done
- **ApproveInvoiceUseCase** — `application/review/approve-invoice.use-case.ts` (5 tests)
  - Status guard (needs_review only), batch counter update, batch-not-found edge case
- **RejectInvoiceUseCase** — `application/review/reject-invoice.use-case.ts` (6 tests)
  - Reason validation (non-empty), status guard, batch error counter
- **EditInvoiceUseCase** — `application/review/edit-invoice.use-case.ts` (5 tests)
  - Editable field whitelist, setExtractedData + markAsNeedsReview restore, non-editable fields ignored
- **CreateSchemaUseCase** — `application/schema/create-schema.use-case.ts` (5 tests)
  - Tax ID validation via TaxId VO, duplicate check by NCC tax ID, cascade create rules+fields
- **UpdateSchemaUseCase** — `application/schema/update-schema.use-case.ts` (4 tests)
  - updateInfo, updatePromptTemplate, activate/deactivate status transitions
- **SyncProductsUseCase** — `application/product/sync-products.use-case.ts` (5 tests)
  - Create new, update existing, idempotent re-sync, API error handling, conflict detection
- **CreateMappingUseCase** — `application/mapping/create-mapping.use-case.ts` (4 tests)
  - Manual/auto_learned/bulk_import sources, schema existence check
- **CreateExportUseCase** — `application/export/create-export.use-case.ts` (5 tests)
  - CSV/JSON serialization, empty exports, filter approved only, invalid format guard
- **ApplicationModule** updated — all 10 use cases registered (2 prior + 8 new)
- **Quality gate**: tsc ✅ | 361 tests ✅ | architecture drift ✅

### What was found
- `InvoiceType` is typed union `'original' | 'adjustment' | 'replacement'` — not free-form string
- `Product.markSynced()` requires `externalId: string` argument
- `FingerprintRule` valid rule types: `'mst_exact' | 'keyword' | 'symbol_regex' | 'custom'` (not `'tax_id'`)
- `EditInvoiceUseCase` must call `setExtractedData()` then `markAsNeedsReview()` to preserve status
- `InvoiceProps` is a typed interface — cannot be cast to `Record<string, unknown>` directly

### What's next
- **Session 9**: Phase Step 3.1 — All REST controllers + DTOs + OpenAPI spec
  - Batch/upload controllers
  - Invoice/processing controllers
  - Review controllers
  - Schema CRUD controllers
  - Product sync controllers
  - Mapping controllers
  - Export controllers

### Test counts
- Previous: 322 tests
- Added: 39 tests
- Current: 361 tests (40 suites)
