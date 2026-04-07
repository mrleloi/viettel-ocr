/**
 * Seed script — populates the database with demo data.
 * Creates sample schemas, products, and mappings for development/demo.
 * Usage: npm run seed
 *
 * Safe to run multiple times — uses INSERT OR IGNORE.
 */
const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'db', 'invoice-tool.db');

/**
 * Creates a UTC ISO timestamp string.
 * @returns {string} ISO timestamp
 */
function now() {
  return new Date().toISOString();
}

/**
 * Seeds the database with demo data.
 */
function seed() {
  console.log('🌱 Seeding database...\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const ts = now();

  // --- Schemas ---
  const schemaIds = {
    digiworld: randomUUID(),
    samsung: randomUUID(),
    fpt: randomUUID(),
  };

  const insertSchema = db.prepare(`
    INSERT OR IGNORE INTO schemas (id, name, description, ncc_name, ncc_tax_id, status, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSchema.run(schemaIds.digiworld, 'Digiworld', 'Schema cho Công ty TNHH Thế Giới Di Động', 'Công ty TNHH Thế Giới Di Động', '0302861742', 'active', 1, ts, ts);
  insertSchema.run(schemaIds.samsung, 'Samsung', 'Schema cho Samsung Electronics Việt Nam', 'SAMSUNG ELECTRONICS VINA', '0105571285', 'active', 1, ts, ts);
  insertSchema.run(schemaIds.fpt, 'FPT', 'Schema cho FPT Trading', 'Công ty Cổ phần FPT Trading', '0101689753', 'draft', 1, ts, ts);
  console.log('  ✅ 3 schemas created (Digiworld, Samsung, FPT)');

  // --- Fingerprint Rules ---
  const insertRule = db.prepare(`
    INSERT OR IGNORE INTO fingerprint_rules (id, schema_id, rule_type, pattern, priority, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertRule.run(randomUUID(), schemaIds.digiworld, 'tax_id', '0302861742', 100, 1, ts);
  insertRule.run(randomUUID(), schemaIds.samsung, 'tax_id', '0105571285', 100, 1, ts);
  insertRule.run(randomUUID(), schemaIds.fpt, 'tax_id', '0101689753', 100, 1, ts);
  console.log('  ✅ 3 fingerprint rules created');

  // --- Products ---
  const productIds = {};
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (id, product_code, product_name, unit, category, brand, is_active, sync_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const productData = [
    { code: 'VTT-SIM-001', name: 'SIM 4G Viettel', unit: 'Cái', category: 'SIM', brand: 'Viettel' },
    { code: 'VTT-PKG-V120', name: 'Gói cước V120', unit: 'Gói', category: 'Gói cước', brand: 'Viettel' },
    { code: 'VTT-DEV-001', name: 'Modem 4G Viettel D6610', unit: 'Cái', category: 'Thiết bị', brand: 'Viettel' },
    { code: 'VTT-SVC-CLOUD', name: 'Viettel Cloud VPS Basic', unit: 'Tháng', category: 'Dịch vụ', brand: 'Viettel IDC' },
    { code: 'VTT-NET-FTTH', name: 'Internet cáp quang FTTH 150Mbps', unit: 'Tháng', category: 'Dịch vụ', brand: 'Viettel' },
  ];

  for (const p of productData) {
    const id = randomUUID();
    productIds[p.code] = id;
    insertProduct.run(id, p.code, p.name, p.unit, p.category, p.brand, 1, 'synced', ts, ts);
  }
  console.log(`  ✅ ${productData.length} products created`);

  // --- Mappings ---
  const insertMapping = db.prepare(`
    INSERT OR IGNORE INTO mappings (id, schema_id, partner_product_name, partner_product_code, viettel_product_id, viettel_product_code, viettel_product_name, status, source, confidence, usage_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const mappingData = [
    {
      schemaId: schemaIds.digiworld,
      partnerName: 'SIM 4G LTE Viettel (New)',
      partnerCode: 'DGW-SIM-4G',
      prodCode: 'VTT-SIM-001',
      prodName: 'SIM 4G Viettel',
      source: 'manual',
      confidence: 1.0,
    },
    {
      schemaId: schemaIds.digiworld,
      partnerName: 'Gói V120 Data 60GB',
      partnerCode: 'DGW-V120',
      prodCode: 'VTT-PKG-V120',
      prodName: 'Gói cước V120',
      source: 'ai_suggested',
      confidence: 0.92,
    },
    {
      schemaId: schemaIds.samsung,
      partnerName: 'Modem phát WiFi D6610',
      partnerCode: 'SAM-MDM-001',
      prodCode: 'VTT-DEV-001',
      prodName: 'Modem 4G Viettel D6610',
      source: 'ai_suggested',
      confidence: 0.88,
    },
  ];

  for (const m of mappingData) {
    insertMapping.run(
      randomUUID(),
      m.schemaId,
      m.partnerName,
      m.partnerCode,
      productIds[m.prodCode],
      m.prodCode,
      m.prodName,
      'active',
      m.source,
      m.confidence,
      0,
      ts,
      ts,
    );
  }
  console.log(`  ✅ ${mappingData.length} mappings created`);

  // --- Demo Batch + Invoices ---
  const batchId = randomUUID();
  db.prepare(`
    INSERT OR IGNORE INTO batches (id, upload_mode, total_files, processed_files, success_files, error_files, status, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, 'single_ncc', 3, 3, 2, 1, 'completed', ts, ts);

  const insertInvoice = db.prepare(`
    INSERT OR IGNORE INTO invoices (id, batch_id, original_filename, storage_path, file_hash, file_size_bytes, page_count, status, schema_id, classification_method, invoice_number, seller_name, seller_tax_id, buyer_name, buyer_tax_id, invoice_date, total, vat_amount, overall_confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInvoice.run(
    randomUUID(), batchId, 'hoadon_001.pdf', 'uploads/hoadon_001.pdf', 'aabbcc001', 524288, 1,
    'completed', schemaIds.digiworld, 'fingerprint',
    'HD/2026/001', 'Công ty TNHH Thế Giới Di Động', '0302861742', 'Tập đoàn Viettel', '0100109106',
    '2026-04-01', 15000000, 1500000, 0.95,
    ts, ts,
  );
  insertInvoice.run(
    randomUUID(), batchId, 'hoadon_002.pdf', 'uploads/hoadon_002.pdf', 'aabbcc002', 312456, 1,
    'needs_review', schemaIds.digiworld, 'fingerprint',
    'HD/2026/002', 'Công ty TNHH Thế Giới Di Động', '0302861742', 'Tập đoàn Viettel', '0100109106',
    '2026-04-03', 8500000, 850000, 0.72,
    ts, ts,
  );
  insertInvoice.run(
    randomUUID(), batchId, 'hoadon_error.pdf', 'uploads/hoadon_error.pdf', 'aabbcc003', 102400, 1,
    'error', null, null,
    null, null, null, null, null,
    null, null, null, null,
    ts, ts,
  );
  console.log('  ✅ 1 demo batch + 3 invoices created');

  db.close();

  console.log('\n🌱 Seed complete!\n');
  console.log('  Run "npm start" to see the demo data in the UI.\n');
}

try {
  seed();
} catch (err) {
  console.error('\n❌ Seed failed:', err.message);
  console.error('   Make sure to run "npm run setup" first.\n');
  process.exit(1);
}
