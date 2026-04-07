# Data Flow Design

**Version**: 1.0  
**Date**: 2026-04-07  

---

## 1. Primary Flow: Upload → Process → Output

```
┌──────────┐
│ OPERATOR │
│ uploads  │
│ files    │
└────┬─────┘
     │  POST /api/batches (multipart: files[] + upload_mode + hint_schema_id)
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: INTAKE                                                         │
│                                                                         │
│ 1.1 Create batch record (status: uploading)                            │
│ 1.2 For each file:                                                      │
│     ├── Is ZIP? → Extract to temp, iterate PDF contents                │
│     ├── Is PDF? → Validate (size, pages, not corrupt)                  │
│     │   ├── PASS → Compute SHA-256 hash                                │
│     │   │         Save to data/uploads/{batch_id}/                     │
│     │   │         Create invoice record (status: pending)              │
│     │   └── FAIL → Create invoice record (status: error, error detail) │
│     └── Other → Skip, add to batch warning log                        │
│ 1.3 Update batch (total_files, status: processing)                     │
│ 1.4 Enqueue all pending invoices to processing queue                   │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: DEDUP CHECK (per invoice, in queue)                           │
│                                                                         │
│ 2.1 Check file_hash against DB                                         │
│     ├── Exact match found → status: duplicate, link duplicate_of       │
│ 2.2 Check extracted key (if available from cache):                     │
│     │   (invoice_symbol + invoice_number + seller_tax_id)              │
│     ├── Match found → status: duplicate, create notification           │
│     └── No match → continue                                           │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: CLASSIFY                                                       │
│                                                                         │
│ Decision tree:                                                          │
│                                                                         │
│ Has frontend hint (user chose NCC)?                                    │
│ ├── YES → schema_id = hint, method = "frontend_hint"                   │
│ │         Run fingerprint anyway (for validation):                      │
│ │         ├── Fingerprint agrees → confidence += 0.3                   │
│ │         └── Fingerprint disagrees → flag conflict, lower confidence  │
│ │         → GOTO STAGE 4 with determined schema                       │
│ └── NO (mixed or unknown mode)                                         │
│     Run fingerprint rules (ordered by priority):                       │
│     ├── Match found → schema_id = matched, method = "fingerprint"      │
│     │   → GOTO STAGE 4                                                 │
│     └── No match →                                                      │
│         ├── mode = "unknown" → Queue for LLM classification             │
│         │   (see Stage 3b)                                              │
│         └── mode = "mixed" → Queue for LLM classification              │
│                                                                         │
│ STAGE 3b: LLM CLASSIFICATION (only for unmatched)                      │
│ Send to Gemini Flash:                                                   │
│   Input: PDF + list of active schema names/descriptions                │
│   Output: {suggested_schema: "X", confidence: 0.82, reason: "..."}     │
│ ├── High confidence → assign schema, method = "llm"                    │
│ └── Low confidence → status: review_pending, category: unknown_type    │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: OCR + EXTRACT                                                  │
│                                                                         │
│ 4.1 Check cache: file_hash + schema_id → cached extraction?           │
│     ├── YES → Use cached result, skip API call                         │
│     └── NO → Continue                                                   │
│ 4.2 Build Gemini prompt:                                                │
│     ├── Load prompt_template from schema                               │
│     ├── Include field_definitions as extraction targets                 │
│     └── Include validation hints                                        │
│ 4.3 Call Gemini Flash API:                                              │
│     ├── Input: PDF file (base64) + prompt                              │
│     ├── Output: JSON with extracted fields + per-field confidence       │
│     ├── Retry on failure (3 attempts, exponential backoff)             │
│     └── On final failure → status: error, create notification          │
│ 4.4 Parse and store:                                                    │
│     ├── raw_ocr_text → invoices.raw_ocr_text                          │
│     ├── Parsed JSON → invoices.extracted_data                          │
│     ├── Denormalized fields → invoices.invoice_number, etc.            │
│     ├── Line items → invoice_line_items rows                           │
│     └── Field confidences → invoices.field_confidences                 │
│ 4.5 Cache result: store hash → extraction for future reuse             │
│ 4.6 Log trace entry (ocr_extract step)                                 │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: VALIDATE                                                       │
│                                                                         │
│ 5.1 Field-level validation:                                             │
│     For each field in schema_field_definitions:                        │
│     ├── Required check: field present and non-null?                    │
│     ├── Type check: matches declared data_type?                        │
│     ├── Format check: matches validation_regex?                        │
│     └── Business rules: date not future, MST format, etc.             │
│ 5.2 Cross-field validation:                                             │
│     ├── subtotal = Σ line_item.amount (± tolerance)                    │
│     ├── vat_amount = subtotal × vat_rate / 100 (± 1 VND)             │
│     ├── total = subtotal + vat_amount (± 1 VND)                       │
│     └── line_item.amount = quantity × unit_price                      │
│ 5.3 Cross-invoice validation (post-extract dedup):                     │
│     ├── Check (symbol + number + seller_tax_id) against DB            │
│     └── Detect adjustment/replacement keywords                        │
│ 5.4 Store validation results:                                          │
│     ├── invoices.validation_errors = JSON array                        │
│     └── Update field_confidences (failed fields → confidence = 0)      │
│ 5.5 Log trace entry (validate step)                                    │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 6: MAP PRODUCTS                                                   │
│                                                                         │
│ For each invoice_line_item:                                             │
│ 6.1 Lookup product_mappings:                                            │
│     WHERE source_product_name ≈ line_item.product_name                 │
│     AND source_ncc_tax_id = invoice.seller_tax_id                      │
│     ├── Exact match → mapping_status: mapped, link viettel_product     │
│     ├── No match → Fuzzy search:                                       │
│     │   ├── Score ≥ 0.8 → mapping_status: mapped (auto)               │
│     │   ├── 0.5 ≤ Score < 0.8 → mapping_status: ambiguous             │
│     │   │   Store top 3 suggestions in mapping_suggestions             │
│     │   └── Score < 0.5 → mapping_status: unmapped                    │
│     └── Multiple exact matches → mapping_status: ambiguous             │
│ 6.2 Aggregate line_item statuses:                                       │
│     ├── All mapped → invoice.mapping_status = fully_mapped             │
│     ├── Some unmapped/ambiguous → partially_mapped                     │
│     └── All unmapped → unmapped                                        │
│ 6.3 Log trace entry (map_products step)                                │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 7: SCORE & ROUTE                                                  │
│                                                                         │
│ 7.1 Calculate overall_confidence:                                       │
│     = 0.30 × frontend_hint_score                                       │
│     + 0.25 × fingerprint_score                                         │
│     + 0.25 × extraction_quality_score (avg field confidence)           │
│     + 0.10 × validation_pass_rate (% rules passed)                    │
│     + 0.10 × mapping_completeness (% line items mapped)               │
│                                                                         │
│ 7.2 Load behavior config from schema:                                   │
│     ├── confidence ≥ high_threshold → on_high_confidence action        │
│     ├── medium_threshold ≤ confidence < high_threshold → review        │
│     └── confidence < medium_threshold → configurator review            │
│                                                                         │
│ 7.3 Route:                                                              │
│     ├── AUTO → status: auto_completed → GOTO STAGE 8                  │
│     ├── REVIEW → status: review_pending → create notification          │
│     └── CONFIGURATOR → status: review_pending → create notification    │
│                                                                         │
│ 7.4 Log trace entry (route step)                                       │
└────┬────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 8: ACTION                                                         │
│                                                                         │
│ Based on behavior config:                                               │
│ ├── show_web → No file action. Data visible on UI                      │
│ ├── export_csv/json/excel →                                             │
│ │   ├── If auto_export = true → Generate file immediately              │
│ │   └── If auto_export = false → Available for manual export           │
│ └── push_webhook → (Phase 2, not implemented in MVP)                   │
│                                                                         │
│ Update batch counters (success_count, review_count, error_count)        │
│ If batch fully processed → batch.status = completed                    │
│ Create notification: "Batch #X completed: Y OK, Z review needed"       │
│ Log trace entry (action step)                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Secondary Flow: Review & Approval

```
OPERATOR views review queue
     │  GET /api/invoices?status=review_pending
     ▼
┌──────────────────────────────────────────────┐
│ Review Screen                                │
│ Shows: PDF (left) + extracted data (right)   │
│ Fields highlighted by confidence color       │
└────┬──────────┬──────────┬───────────────────┘
     │          │          │
     ▼          ▼          ▼
  [Approve]  [Edit]    [Reject]
     │          │          │
     │          │          ▼
     │          │    POST /api/invoices/:id/reject
     │          │    {reason: "...", notes: "..."}
     │          │    → status: review_rejected
     │          │    → audit_log entry
     │          │
     │          ▼
     │    PUT /api/invoices/:id
     │    {field_changes: {...}}
     │    → Update extracted_data
     │    → audit_log entry (old vs new values)
     │    → If line_item mapping changed:
     │      "Apply to all similar?" → create/update product_mapping
     │    → Then approve:
     │
     ▼
  POST /api/invoices/:id/approve
  → status: review_approved
  → Execute behavior action (export etc.)
  → audit_log entry
  → Update batch counters
```

---

## 3. Secondary Flow: Schema CRUD

```
CONFIGURATOR creates schema
     │
     ▼
┌─────────────────────────────────────────────────┐
│ STEP 1: Basic Info                              │
│ Input: name, ncc_name, ncc_tax_id, description  │
│ → Create schema record (status: draft)          │
└────┬────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────┐
│ STEP 2: Upload Samples                          │
│ Input: 1-5 sample PDF files                     │
│ → Store in data/schemas/{schema_id}/samples/    │
│ → Run OCR on each → show raw text on UI         │
└────┬────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────┐
│ STEP 3: Define Fields                           │
│ Configurator sees OCR text                      │
│ → Selects/highlights regions → assigns labels   │
│ → System creates schema_field_definitions       │
│ → Auto-generates prompt_template from fields    │
└────┬────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────┐
│ STEP 4: Fingerprint Rules                       │
│ Auto-suggest: MST from sample → mst_exact rule  │
│ Configurator can add/edit/remove rules          │
└────┬────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────┐
│ STEP 5: Behavior Config                         │
│ Choose action per confidence level              │
│ Default for new schema: show_web_only           │
└────┬────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────┐
│ STEP 6: Test Run                                │
│ Process sample files through full pipeline      │
│ Show results inline → Configurator verifies     │
│ If OK → status: testing (or active)             │
│ If not → back to edit fields/prompt             │
└─────────────────────────────────────────────────┘
```

---

## 4. Secondary Flow: Product Sync

```
TRIGGER: Manual click "Sync Now" OR scheduled timer
     │
     ▼
┌─────────────────────────────────────────────────┐
│ 1. Fetch from Viettel Product API               │
│    GET {configured_url}/products                 │
│    → Array of {code, name, category, status}    │
└────┬────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│ 2. Compare with local DB                        │
│                                                  │
│ For each API product:                           │
│ ├── Not in DB → INSERT + conflict: new_product  │
│ ├── In DB, same data → UPDATE synced_at only    │
│ ├── In DB, name changed → UPDATE + conflict     │
│ ├── In DB, code changed → conflict: code_changed│
│ └── In DB, status changed → UPDATE + conflict   │
│                                                  │
│ For each DB product NOT in API:                 │
│ → conflict: product_removed                     │
│                                                  │
│ Create product_sync_conflicts for all changes   │
└────┬────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│ 3. Notify if conflicts exist                    │
│    Notification: "Sync completed: X conflicts"  │
│    Configurator resolves on conflicts page      │
│    Accept → update product + cascade mappings   │
│    Ignore → keep local data                     │
└─────────────────────────────────────────────────┘
```

---

## 5. Real-time Data Flow (SSE)

```
Browser (EventSource)
     │
     │  GET /api/events (SSE connection, persistent)
     │
     ▼
NestJS SSE Controller
     │
     │  Listens to internal event emitter:
     │  ├── batch.progress → {batch_id, processed: 12, total: 50}
     │  ├── invoice.status_changed → {invoice_id, new_status}
     │  ├── notification.created → {notification object}
     │  └── product.sync_completed → {conflicts_count}
     │
     ▼
Browser handles events:
     ├── batch.progress → Update progress bar
     ├── invoice.status_changed → Update table row
     ├── notification.created → Increment bell badge, show toast
     └── product.sync_completed → Show alert if conflicts
```
