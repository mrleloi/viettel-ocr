/**
 * Manual end-to-end test:
 *  1) POST the test PDF to /api/batches
 *  2) Poll /api/batches/:id until processed
 *  3) Print the resulting invoice(s)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PDF_PATH = path.resolve(__dirname, '..', 'files', '1_002_K26TDH_80321_8198.pdf');
const HOST = 'localhost';
const PORT = 3000;

function request(method, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: HOST, port: PORT, path: urlPath, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, body: buf.toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildMultipart(filePath, fields) {
  const boundary = '----nodeBoundary' + Date.now();
  const fileBuf = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${k}"\r\n\r\n`));
    parts.push(Buffer.from(`${v}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(
    Buffer.from(
      `Content-Disposition: form-data; name="files"; filename="${filename}"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`,
    ),
  );
  parts.push(fileBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return {
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  };
}

async function getJson(urlPath) {
  const r = await request('GET', urlPath, {});
  try {
    return { status: r.status, json: JSON.parse(r.body) };
  } catch {
    return { status: r.status, raw: r.body };
  }
}

async function main() {
  console.log('PDF:', PDF_PATH, 'exists?', fs.existsSync(PDF_PATH));
  const { body, headers } = buildMultipart(PDF_PATH, { uploadMode: 'mixed' });

  console.log('Uploading…');
  const up = await request('POST', '/api/batches', headers, body);
  console.log('Upload status:', up.status);
  console.log('Upload body :', up.body);

  let parsed;
  try {
    parsed = JSON.parse(up.body);
  } catch (e) {
    console.error('Could not parse upload response.');
    process.exit(1);
  }
  if (!parsed.batchId) {
    console.error('No batchId returned.');
    process.exit(1);
  }

  // Poll batch until processed
  const batchId = parsed.batchId;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const b = await getJson(`/api/batches/${batchId}`);
    console.log(`[poll ${i}] batch:`, JSON.stringify(b.json));
    if (b.json && (b.json.status === 'completed' || b.json.status === 'failed' || b.json.processedFiles >= b.json.totalFiles)) {
      break;
    }
  }

  // List invoices for the batch
  const invs = await getJson(`/api/invoices?batchId=${batchId}`);
  console.log('\nInvoices:', JSON.stringify(invs.json, null, 2));

  if (invs.json && Array.isArray(invs.json) && invs.json.length > 0) {
    const id = invs.json[0].id;
    const detail = await getJson(`/api/invoices/${id}`);
    console.log('\nInvoice detail:', JSON.stringify(detail.json, null, 2));
  } else if (invs.json && invs.json.invoices && invs.json.invoices.length > 0) {
    const id = invs.json.invoices[0].id;
    const detail = await getJson(`/api/invoices/${id}`);
    console.log('\nInvoice detail:', JSON.stringify(detail.json, null, 2));
  }
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
