/**
 * Reset all invoice/batch/job data for a clean e2e test run.
 * Preserves schema table structure; only deletes rows.
 */
const path = require('path');
const fs = require('fs');
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
const uploadsDir = path.resolve(
  __dirname,
  '..',
  'invoice-tool',
  'packages',
  'backend',
  'data',
  'uploads',
);

const db = new Database(dbPath);

// Delete in dependency order
const tables = [
  'processing_traces',
  'processing_jobs',
  'validation_errors',
  'line_items',
  'invoices',
  'batches',
  'mappings',
  'schemas',
  'field_definitions',
];

db.pragma('foreign_keys = OFF');
for (const t of tables) {
  try {
    const info = db.prepare(`DELETE FROM ${t}`).run();
    console.log(`cleared ${t}: ${info.changes} rows`);
  } catch (e) {
    console.log(`skip ${t}: ${e.message}`);
  }
}
db.pragma('foreign_keys = ON');
db.close();

if (fs.existsSync(uploadsDir)) {
  for (const f of fs.readdirSync(uploadsDir)) {
    const p = path.join(uploadsDir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.unlinkSync(p);
    }
  }
  console.log('cleared uploads dir');
}
console.log('done');
