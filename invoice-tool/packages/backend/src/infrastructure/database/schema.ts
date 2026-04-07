import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============================================================
// Drizzle Schema Definitions — matches tasks/04-database-design.md
// ============================================================

// --- SCHEMA MANAGEMENT CONTEXT ---

export const schemas = sqliteTable('schemas', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  nccName: text('ncc_name').notNull(),
  nccTaxId: text('ncc_tax_id').notNull(),
  status: text('status').notNull().default('draft'),
  promptTemplate: text('prompt_template'),
  behaviorConfig: text('behavior_config'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const fingerprintRules = sqliteTable('fingerprint_rules', {
  id: text('id').primaryKey(),
  schemaId: text('schema_id').notNull().references(() => schemas.id),
  ruleType: text('rule_type').notNull(),
  pattern: text('pattern').notNull(),
  priority: integer('priority').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const fieldDefinitions = sqliteTable('field_definitions', {
  id: text('id').primaryKey(),
  schemaId: text('schema_id').notNull().references(() => schemas.id),
  fieldName: text('field_name').notNull(),
  displayName: text('display_name').notNull(),
  dataType: text('data_type').notNull().default('string'),
  isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(false),
  validationRules: text('validation_rules'),
  extractionHint: text('extraction_hint'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// --- INTAKE CONTEXT ---

export const batches = sqliteTable('batches', {
  id: text('id').primaryKey(),
  uploadMode: text('upload_mode').notNull().default('single_ncc'),
  hintSchemaId: text('hint_schema_id').references(() => schemas.id),
  totalFiles: integer('total_files').notNull().default(0),
  processedFiles: integer('processed_files').notNull().default(0),
  successFiles: integer('success_files').notNull().default(0),
  errorFiles: integer('error_files').notNull().default(0),
  status: text('status').notNull().default('uploading'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

// --- PROCESSING CONTEXT ---

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.id),
  originalFilename: text('original_filename').notNull(),
  storagePath: text('storage_path').notNull(),
  fileHash: text('file_hash').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  status: text('status').notNull().default('pending'),
  schemaId: text('schema_id').references(() => schemas.id),
  classificationMethod: text('classification_method'),
  classificationConfidence: real('classification_confidence'),

  // Extracted header fields
  invoiceNumber: text('invoice_number'),
  invoiceSymbol: text('invoice_symbol'),
  invoiceDate: text('invoice_date'),
  invoiceType: text('invoice_type'),
  sellerName: text('seller_name'),
  sellerTaxId: text('seller_tax_id'),
  buyerName: text('buyer_name'),
  buyerTaxId: text('buyer_tax_id'),
  subtotal: integer('subtotal'),
  vatRate: real('vat_rate'),
  vatAmount: integer('vat_amount'),
  total: integer('total'),
  poNumber: text('po_number'),

  // Line items (JSON text)
  lineItems: text('line_items'),

  // Processing metadata
  overallConfidence: real('overall_confidence'),
  ocrRawText: text('ocr_raw_text'),
  extractedRawJson: text('extracted_raw_json'),
  validationErrors: text('validation_errors'),
  fieldConfidences: text('field_confidences'),

  // Duplicate tracking
  duplicateOf: text('duplicate_of'),

  // Timestamps
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  processedAt: text('processed_at'),
  reviewedAt: text('reviewed_at'),
  reviewedBy: text('reviewed_by'),
});

export const processingTraces = sqliteTable('processing_traces', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  inputData: text('input_data'),
  outputData: text('output_data'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').notNull(),
});

// --- CATALOG CONTEXT ---

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  productCode: text('product_code').notNull().unique(),
  productName: text('product_name').notNull(),
  unit: text('unit'),
  category: text('category'),
  brand: text('brand'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncStatus: text('sync_status').notNull().default('local_only'),
  externalId: text('external_id'),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mappings = sqliteTable('mappings', {
  id: text('id').primaryKey(),
  schemaId: text('schema_id').notNull().references(() => schemas.id),
  partnerProductName: text('partner_product_name').notNull(),
  partnerProductCode: text('partner_product_code'),
  viettelProductId: text('viettel_product_id').references(() => products.id),
  viettelProductCode: text('viettel_product_code'),
  viettelProductName: text('viettel_product_name'),
  status: text('status').notNull().default('active'),
  source: text('source').notNull().default('manual'),
  confidence: real('confidence'),
  usageCount: integer('usage_count').notNull().default(0),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const syncConflicts = sqliteTable('sync_conflicts', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  fieldName: text('field_name').notNull(),
  localValue: text('local_value').notNull(),
  remoteValue: text('remote_value').notNull(),
  resolvedAt: text('resolved_at'),
  resolvedAction: text('resolved_action'),
  createdAt: text('created_at').notNull(),
});

// --- REVIEW CONTEXT ---

export const reviewActions = sqliteTable('review_actions', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  action: text('action').notNull(),
  previousData: text('previous_data'),
  newData: text('new_data'),
  reason: text('reason'),
  reviewedBy: text('reviewed_by').notNull(),
  createdAt: text('created_at').notNull(),
});

// --- OUTPUT CONTEXT ---

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  format: text('format').notNull(),
  filters: text('filters'),
  status: text('status').notNull().default('pending'),
  filePath: text('file_path'),
  totalRecords: integer('total_records'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// --- INFRASTRUCTURE ---

export const processingJobs = sqliteTable('processing_jobs', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: text('updated_at').notNull(),
});
