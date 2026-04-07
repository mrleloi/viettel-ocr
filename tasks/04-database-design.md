# Database Design — SQLite Schema

**Version**: 1.0  
**Date**: 2026-04-07  
**Engine**: SQLite 3 (WAL mode)  
**ORM**: Drizzle ORM  

---

## 1. Entity Relationship Overview

```
schemas ──1:N── schema_fingerprint_rules
schemas ──1:N── schema_field_definitions
schemas ──1:N── schema_prompt_versions
schemas ──1:N── schema_sample_files
schemas ──1:1── schema_behavior_config

batches ──1:N── invoices

invoices ──1:N── invoice_line_items
invoices ──1:N── invoice_field_extractions
invoices ──1:N── processing_trace_entries
invoices ──N:1── schemas

viettel_products ──1:N── product_mappings
viettel_products ──1:N── product_sync_conflicts

product_mappings ──N:1── schemas (scoped by NCC)

notifications (standalone)
export_jobs ──1:N── invoices (via export_job_items)
system_config (key-value)
```

---

## 2. Table Definitions

### 2.1 schemas

Core table for invoice type definitions.

```sql
CREATE TABLE schemas (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name              TEXT NOT NULL,                    -- "Digiworld VAT Invoice"
  description       TEXT,
  ncc_name          TEXT NOT NULL,                    -- "Digiworld"
  ncc_tax_id        TEXT,                             -- "0302861742-001"
  status            TEXT NOT NULL DEFAULT 'draft',    -- draft | testing | active | disabled
  version           INTEGER NOT NULL DEFAULT 1,
  prompt_template   TEXT,                             -- Current Gemini prompt template
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_schemas_status ON schemas(status);
CREATE INDEX idx_schemas_ncc_tax_id ON schemas(ncc_tax_id);
```

### 2.2 schema_fingerprint_rules

Rules for code-based invoice classification.

```sql
CREATE TABLE schema_fingerprint_rules (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  schema_id         TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  rule_type         TEXT NOT NULL,        -- mst_exact | mst_contains | keyword_contains | symbol_regex | custom_regex
  rule_field        TEXT NOT NULL,        -- which OCR text area to check: full_text | seller_tax_id | invoice_symbol | header
  rule_value        TEXT NOT NULL,        -- the pattern/value to match
  priority          INTEGER NOT NULL DEFAULT 0,  -- lower = higher priority
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fingerprint_schema ON schema_fingerprint_rules(schema_id);
```

### 2.3 schema_field_definitions

Fields to extract per schema.

```sql
CREATE TABLE schema_field_definitions (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  schema_id         TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  field_key         TEXT NOT NULL,        -- "invoice_number", "seller_name", etc.
  field_label       TEXT NOT NULL,        -- "Số hóa đơn" (Vietnamese display label)
  data_type         TEXT NOT NULL,        -- string | integer | decimal | date | boolean
  is_required       INTEGER NOT NULL DEFAULT 1,  -- boolean
  is_line_item      INTEGER NOT NULL DEFAULT 0,  -- 1 if this field belongs to line_items array
  validation_regex  TEXT,                 -- optional regex for validation
  extraction_hint   TEXT,                 -- hint for Gemini prompt (e.g., "near label 'Số:'")
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_field_def_schema ON schema_field_definitions(schema_id);
```

### 2.4 schema_behavior_config

Post-processing behavior per confidence level.

```sql
CREATE TABLE schema_behavior_config (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  schema_id         TEXT NOT NULL UNIQUE REFERENCES schemas(id) ON DELETE CASCADE,
  on_high_confidence  TEXT NOT NULL DEFAULT 'show_web',  -- show_web | export_csv | export_json | export_excel | push_webhook
  on_medium_confidence TEXT NOT NULL DEFAULT 'queue_review',
  on_low_confidence   TEXT NOT NULL DEFAULT 'queue_configurator',
  high_threshold    REAL NOT NULL DEFAULT 0.85,
  medium_threshold  REAL NOT NULL DEFAULT 0.60,
  webhook_url       TEXT,                 -- for future ERP push
  export_format     TEXT DEFAULT 'csv',   -- csv | json | excel
  auto_export       INTEGER NOT NULL DEFAULT 0,  -- boolean: auto-generate export file
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.5 schema_prompt_versions

Version history for prompt templates.

```sql
CREATE TABLE schema_prompt_versions (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  schema_id         TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  prompt_text       TEXT NOT NULL,
  changed_by        TEXT,                 -- user identifier
  change_reason     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prompt_ver_schema ON schema_prompt_versions(schema_id);
```

### 2.6 schema_sample_files

Sample files uploaded for schema testing.

```sql
CREATE TABLE schema_sample_files (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  schema_id         TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  file_path         TEXT NOT NULL,        -- relative to data/ folder
  file_hash         TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.7 batches

Upload batch grouping.

```sql
CREATE TABLE batches (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  upload_mode       TEXT NOT NULL,        -- specific_ncc | mixed | unknown
  hint_schema_id    TEXT REFERENCES schemas(id),  -- user's frontend hint (NCC selection)
  total_files       INTEGER NOT NULL DEFAULT 0,
  processed_files   INTEGER NOT NULL DEFAULT 0,
  success_count     INTEGER NOT NULL DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,
  error_count       INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'uploading',  -- uploading | processing | completed | cancelled
  uploaded_by       TEXT,                 -- user identifier (simple string, no auth)
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_created ON batches(created_at);
```

### 2.8 invoices

Core invoice records.

```sql
CREATE TABLE invoices (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  batch_id          TEXT NOT NULL REFERENCES batches(id),
  schema_id         TEXT REFERENCES schemas(id),       -- determined after classification
  
  -- File info
  original_filename TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  file_hash         TEXT NOT NULL,
  file_size_bytes   INTEGER NOT NULL,
  page_count        INTEGER,
  
  -- Processing status
  status            TEXT NOT NULL DEFAULT 'pending',
    -- pending | processing | extracted | validated | 
    -- auto_completed | review_pending | review_approved | 
    -- review_rejected | error | cancelled | duplicate
  
  -- Classification
  classification_method TEXT,             -- frontend_hint | fingerprint | llm | manual
  classification_confidence REAL,
  
  -- Extracted data (denormalized for quick access)
  invoice_number    TEXT,
  invoice_symbol    TEXT,
  invoice_date      TEXT,                 -- ISO date
  seller_name       TEXT,
  seller_tax_id     TEXT,
  buyer_name        TEXT,
  buyer_tax_id      TEXT,
  subtotal          INTEGER,              -- VND, no decimals
  vat_rate          REAL,
  vat_amount        INTEGER,
  total             INTEGER,
  po_number         TEXT,                 -- extracted PO reference if present
  invoice_type      TEXT DEFAULT 'original',  -- original | adjustment | replacement | cancellation
  reference_invoice TEXT,                 -- for adjustment/replacement: original invoice reference
  
  -- Full extracted JSON (all fields including custom)
  extracted_data    TEXT,                 -- JSON blob
  raw_ocr_text      TEXT,                -- Raw OCR output for audit
  
  -- Confidence & validation
  overall_confidence REAL,
  field_confidences  TEXT,               -- JSON: {"invoice_number": 0.99, "seller_name": 0.85, ...}
  validation_errors  TEXT,               -- JSON array of validation error objects
  
  -- Mapping
  mapping_status    TEXT DEFAULT 'pending',  -- pending | fully_mapped | partially_mapped | unmapped
  
  -- Review
  reviewed_by       TEXT,
  reviewed_at       TEXT,
  review_notes      TEXT,
  reject_reason     TEXT,
  
  -- Duplicate tracking
  duplicate_of      TEXT REFERENCES invoices(id),
  
  -- Timestamps
  processing_started_at TEXT,
  processing_completed_at TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invoices_batch ON invoices(batch_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_schema ON invoices(schema_id);
CREATE INDEX idx_invoices_file_hash ON invoices(file_hash);
CREATE INDEX idx_invoices_seller_tax ON invoices(seller_tax_id);
CREATE INDEX idx_invoices_duplicate ON invoices(invoice_symbol, invoice_number, seller_tax_id);
CREATE INDEX idx_invoices_created ON invoices(created_at);
```

### 2.9 invoice_line_items

Extracted line items per invoice.

```sql
CREATE TABLE invoice_line_items (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id        TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number       INTEGER NOT NULL,
  product_name      TEXT,                 -- name as on invoice
  unit              TEXT,                 -- "Cái", "Bộ", etc.
  quantity          REAL,
  unit_price        INTEGER,              -- VND
  amount            INTEGER,              -- VND (quantity × unit_price)
  vat_rate          REAL,
  vat_amount        INTEGER,
  total_with_vat    INTEGER,
  
  -- Mapping
  mapping_id        TEXT REFERENCES product_mappings(id),
  viettel_product_id TEXT REFERENCES viettel_products(id),
  mapping_status    TEXT DEFAULT 'pending',  -- pending | mapped | unmapped | ambiguous
  mapping_confidence REAL,                -- fuzzy match score
  mapping_suggestions TEXT,               -- JSON array of suggested mappings
  
  -- Field confidence
  field_confidences  TEXT,                -- JSON per field
  
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_mapping ON invoice_line_items(mapping_status);
```

### 2.10 viettel_products

Viettel product master data.

```sql
CREATE TABLE viettel_products (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_code      TEXT NOT NULL UNIQUE,
  product_name      TEXT NOT NULL,
  category          TEXT,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | inactive | discontinued
  version           INTEGER NOT NULL DEFAULT 1,
  raw_api_data      TEXT,                 -- Full API response JSON for audit
  synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_products_code ON viettel_products(product_code);
CREATE INDEX idx_products_status ON viettel_products(status);
```

### 2.11 product_mappings

Mapping table: partner product name → Viettel product.

```sql
CREATE TABLE product_mappings (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source_product_name TEXT NOT NULL,      -- name as appears on invoice
  source_product_code TEXT,               -- code if available
  source_ncc_tax_id TEXT,                 -- scope mapping per NCC (nullable = global)
  target_product_id TEXT NOT NULL REFERENCES viettel_products(id),
  match_type        TEXT NOT NULL DEFAULT 'manual',  -- manual | fuzzy_confirmed | bulk_import | auto_learned
  status            TEXT NOT NULL DEFAULT 'active',  -- active | disabled
  created_by        TEXT,                 -- user or 'system'
  usage_count       INTEGER NOT NULL DEFAULT 0,  -- how many times this mapping was used
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mappings_source ON product_mappings(source_product_name, source_ncc_tax_id);
CREATE INDEX idx_mappings_target ON product_mappings(target_product_id);
CREATE INDEX idx_mappings_status ON product_mappings(status);
```

### 2.12 product_sync_conflicts

Conflicts detected during Viettel product sync.

```sql
CREATE TABLE product_sync_conflicts (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id        TEXT REFERENCES viettel_products(id),
  conflict_type     TEXT NOT NULL,        -- name_changed | code_changed | product_removed | new_product
  old_value         TEXT,
  new_value         TEXT,
  status            TEXT NOT NULL DEFAULT 'unresolved',  -- unresolved | accepted | ignored | manually_resolved
  resolved_by       TEXT,
  resolved_at       TEXT,
  affected_mappings INTEGER DEFAULT 0,    -- count of mappings affected
  sync_batch_id     TEXT,                 -- group conflicts from same sync
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_conflicts_status ON product_sync_conflicts(status);
```

### 2.13 processing_trace_entries

Full trace per invoice processing step.

```sql
CREATE TABLE processing_trace_entries (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id        TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  step_name         TEXT NOT NULL,
    -- preprocess | classify | ocr_extract | validate | map_products | 
    -- match_po | route | action | review
  step_order        INTEGER NOT NULL,
  status            TEXT NOT NULL,        -- started | completed | failed | skipped
  input_summary     TEXT,                 -- JSON: key input params
  output_summary    TEXT,                 -- JSON: key output/result
  error_message     TEXT,
  duration_ms       INTEGER,
  api_cost_usd      REAL,                -- estimated cost for AI calls
  started_at        TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at      TEXT
);

CREATE INDEX idx_trace_invoice ON processing_trace_entries(invoice_id);
```

### 2.14 audit_log

User actions audit trail.

```sql
CREATE TABLE audit_log (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_type       TEXT NOT NULL,        -- invoice | schema | mapping | product | batch
  entity_id         TEXT NOT NULL,
  action            TEXT NOT NULL,        -- create | update | delete | approve | reject | export
  actor             TEXT,                 -- user identifier
  changes           TEXT,                 -- JSON: {field: {old: x, new: y}}
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

### 2.15 notifications

In-app notifications.

```sql
CREATE TABLE notifications (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type              TEXT NOT NULL,        -- error | warning | info | success
  category          TEXT NOT NULL,
    -- duplicate_detected | mapping_not_found | validation_failed |
    -- unknown_type | schema_health_alert | sync_conflict |
    -- batch_completed | export_ready
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  link_url          TEXT,                 -- clickable: navigate to relevant page
  link_entity_type  TEXT,                 -- invoice | batch | schema | mapping | conflict
  link_entity_id    TEXT,
  is_read           INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);
```

### 2.16 export_jobs

Export tracking.

```sql
CREATE TABLE export_jobs (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  format            TEXT NOT NULL,        -- csv | json | excel
  scope             TEXT NOT NULL,        -- batch | filtered | single
  scope_params      TEXT,                 -- JSON: filter criteria
  file_path         TEXT,                 -- generated file path
  filename          TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | generating | completed | failed
  record_count      INTEGER,
  created_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at      TEXT
);
```

### 2.17 system_config

Key-value config store (non-sensitive, UI-configurable settings).

```sql
CREATE TABLE system_config (
  key               TEXT PRIMARY KEY,
  value             TEXT NOT NULL,
  description       TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default config values
INSERT INTO system_config (key, value, description) VALUES
  ('product_sync_interval_hours', '6', 'Hours between automatic product syncs'),
  ('max_concurrent_api_calls', '5', 'Max parallel Gemini API calls'),
  ('max_batch_size', '500', 'Max files per upload batch'),
  ('max_file_size_mb', '20', 'Max single PDF file size in MB'),
  ('duplicate_check_enabled', '1', 'Enable duplicate invoice detection'),
  ('invoice_max_age_days', '180', 'Max invoice age in days (validation)'),
  ('dashboard_refresh_seconds', '30', 'Dashboard auto-refresh interval'),
  ('api_retry_count', '3', 'Number of retries for failed API calls');
```

---

## 3. Indexes Strategy

- Primary lookup patterns: invoice by batch, invoice by status, invoice by file_hash (dedup)
- Composite index for duplicate detection: (invoice_symbol, invoice_number, seller_tax_id)
- Temporal queries: created_at indexes on batches, invoices, audit_log, notifications
- SQLite note: keep index count moderate — each index costs write performance

## 4. Migration Strategy

- Drizzle ORM migration files in `packages/backend/drizzle/`
- `npm run setup` runs all migrations
- Version upgrade: new migration files added, `npm run migrate` applies
- Backward compatible: never drop columns, only add
