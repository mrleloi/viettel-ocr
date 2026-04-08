/**
 * Inspect SQLite for processing_jobs and invoices error info.
 */
const path = require('path');
const Database = require(path.resolve(
  __dirname,
  '..',
  'invoice-tool',
  'node_modules',
  'better-sqlite3',
));

const dbPath = path.resolve(
  __dirname,
  '..',
  'invoice-tool',
  'packages',
  'backend',
  'data',
  'database.sqlite',
);
const db = new Database(dbPath, { readonly: true });

console.log('--- processing_jobs (latest 5) ---');
const jobs = db
  .prepare('SELECT id, invoice_id, status, attempts, last_error, started_at, completed_at FROM processing_jobs ORDER BY created_at DESC LIMIT 5')
  .all();
for (const j of jobs) console.log(JSON.stringify(j, null, 2));

console.log('\n--- invoices (latest 5) ---');
const inv = db
  .prepare('SELECT id, status, classification_method, schema_id, validation_errors, ocr_raw_text FROM invoices ORDER BY created_at DESC LIMIT 5')
  .all();
for (const i of inv) {
  console.log(JSON.stringify({
    id: i.id,
    status: i.status,
    classification_method: i.classification_method,
    schema_id: i.schema_id,
    validation_errors: i.validation_errors,
    ocr_raw_text_len: i.ocr_raw_text ? i.ocr_raw_text.length : 0,
    ocr_raw_text_preview: i.ocr_raw_text ? i.ocr_raw_text.substring(0, 200) : null,
  }, null, 2));
}

console.log('\n--- schemas count ---');
console.log(db.prepare('SELECT COUNT(*) as c FROM schemas').get());

console.log('\n--- field_definitions count ---');
console.log(db.prepare('SELECT COUNT(*) as c FROM field_definitions').get());

console.log('\n--- processing_traces (latest 10) ---');
const traces = db.prepare('SELECT * FROM processing_traces ORDER BY created_at DESC LIMIT 10').all();
for (const t of traces) console.log(JSON.stringify(t, null, 2));
