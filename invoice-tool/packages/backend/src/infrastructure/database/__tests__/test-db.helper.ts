import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

export type TestDB = BetterSQLite3Database<typeof schema>;

/**
 * Create an in-memory SQLite database with all tables for integration testing.
 * @returns Drizzle ORM database instance with schema applied
 */
export function createTestDb(): TestDB {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // Create all tables in dependency order
  sqlite.exec(`
    -- SCHEMA MANAGEMENT
    CREATE TABLE schemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      ncc_name TEXT NOT NULL,
      ncc_tax_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      prompt_template TEXT,
      behavior_config TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE fingerprint_rules (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id),
      rule_type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE field_definitions (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id),
      field_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'string',
      is_required INTEGER NOT NULL DEFAULT 0,
      validation_rules TEXT,
      extraction_hint TEXT,
      output_key TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- INTAKE
    CREATE TABLE batches (
      id TEXT PRIMARY KEY,
      upload_mode TEXT NOT NULL DEFAULT 'single_ncc',
      hint_schema_id TEXT REFERENCES schemas(id),
      total_files INTEGER NOT NULL DEFAULT 0,
      processed_files INTEGER NOT NULL DEFAULT 0,
      success_files INTEGER NOT NULL DEFAULT 0,
      error_files INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'uploading',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      auto_create_schema INTEGER NOT NULL DEFAULT 0
    );

    -- PROCESSING
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id),
      original_filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      schema_id TEXT REFERENCES schemas(id),
      classification_method TEXT,
      classification_confidence REAL,
      invoice_number TEXT,
      invoice_symbol TEXT,
      invoice_date TEXT,
      invoice_type TEXT,
      seller_name TEXT,
      seller_tax_id TEXT,
      buyer_name TEXT,
      buyer_tax_id TEXT,
      subtotal INTEGER,
      vat_rate REAL,
      vat_amount INTEGER,
      total INTEGER,
      po_number TEXT,
      line_items TEXT,
      overall_confidence REAL,
      ocr_raw_text TEXT,
      extracted_raw_json TEXT,
      validation_errors TEXT,
      field_confidences TEXT,
      duplicate_of TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      processed_at TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT
    );

    CREATE TABLE processing_traces (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      input_data TEXT,
      output_data TEXT,
      error_message TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL
    );

    -- CATALOG
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      product_code TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      unit TEXT,
      category TEXT,
      brand TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'local_only',
      external_id TEXT,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE mappings (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id),
      partner_product_name TEXT NOT NULL,
      partner_product_code TEXT,
      viettel_product_id TEXT REFERENCES products(id),
      viettel_product_code TEXT,
      viettel_product_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT 'manual',
      confidence REAL,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE sync_conflicts (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      field_name TEXT NOT NULL,
      local_value TEXT NOT NULL,
      remote_value TEXT NOT NULL,
      resolved_at TEXT,
      resolved_action TEXT,
      created_at TEXT NOT NULL
    );

    -- REVIEW
    CREATE TABLE review_actions (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      action TEXT NOT NULL,
      previous_data TEXT,
      new_data TEXT,
      reason TEXT,
      reviewed_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- OUTPUT
    CREATE TABLE export_jobs (
      id TEXT PRIMARY KEY,
      format TEXT NOT NULL,
      filters TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      file_path TEXT,
      total_records INTEGER,
      error_message TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- INFRASTRUCTURE
    CREATE TABLE processing_jobs (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  return drizzle(sqlite, { schema });
}


