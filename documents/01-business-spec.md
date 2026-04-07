# Business Specification — Invoice Processing Tool MVP (Phase 1)

**Project Code**: INV-TOOL  
**Version**: 1.0  
**Date**: 2026-04-07  
**Status**: Draft for Review  

---

## 1. Executive Summary

### 1.1 Problem Statement

Bộ phận kế toán/kinh doanh tại Viettel Retail đang xử lý thủ công hàng nghìn hóa đơn PDF mỗi ngày từ nhiều nhà cung cấp (NCC). Quy trình hiện tại bao gồm: nhận file PDF qua email → mở từng file → đọc thông tin → nhập tay vào hệ thống ERP → đối chiếu với PO. Quy trình này tốn thời gian, dễ sai sót, và không scale được khi số lượng NCC tăng.

### 1.2 Proposed Solution

Xây dựng một tool web-based nội bộ (chạy localhost) để tự động hóa flow:

```
Input PDF hóa đơn → OCR + AI Extract → Auto-classify & Validate → Structured JSON → Match PO → Export/Action
```

Tool tận dụng AI (Gemini Flash) cho OCR + extraction, kết hợp code-based fingerprinting và cached schema để giảm thiểu chi phí AI và tăng tốc xử lý. Human chỉ can thiệp khi có ngoại lệ.

### 1.3 Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| Tỷ lệ auto-process (không cần human) | ≥ 80% cho NCC đã có schema |
| Thời gian xử lý 1 batch 100 files | ≤ 5 phút |
| Chi phí AI / ngày (1000 files) | ≤ $5 |
| Thời gian onboard NCC mới (tạo schema) | ≤ 30 phút |
| Số bước cài đặt cho user mới | ≤ 3 commands |

---

## 2. Stakeholders & Personas

### 2.1 Persona A — Operator

- **Ai**: Nhân viên kế toán, nhập liệu, kinh doanh
- **Số lượng**: ~5 người (MVP)
- **Technical level**: Thấp — biết dùng web browser, email, Excel
- **Hành vi hàng ngày**: Upload file → Xem kết quả → Xử lý exception
- **Kỳ vọng**: "Upload xong, hệ thống tự chạy, tôi chỉ xem cái nào lỗi"
- **Quyền**: Upload, review, approve/reject, export kết quả
- **Không thấy**: Schema config, system settings, prompt editing

### 2.2 Persona B — Configurator

- **Ai**: Team lead hoặc người hiểu nghiệp vụ sâu
- **Số lượng**: 1-2 người
- **Technical level**: Trung bình — hiểu cấu trúc hóa đơn, mapping sản phẩm
- **Hành vi**: Config schema mới, resolve mapping conflict, monitor quality
- **Quyền**: Tất cả quyền Operator + Schema management, Mapping master, Product sync, Behavior config
- **Access**: Qua các menu/setting ẩn, không hiển thị mặc định trên dashboard chính

### 2.3 Persona C — Technical Support

- **Ai**: Dev/IT team, support remote
- **Số lượng**: 1-2 người, không dùng hàng ngày
- **Hành vi**: Được gọi khi có lỗi, cần xem log, health check, tracing
- **Quyền**: Xem dashboard diagnostic, log, config
- **Access**: Qua URL riêng hoặc menu ẩn (ví dụ: /admin/diagnostics)

---

## 3. Feature Specification

### 3.1 F01 — File Upload & Preprocessing

**Description**: Operator upload hóa đơn PDF vào hệ thống. Hệ thống chấp nhận nhiều format input và tự preprocessing.

**Accepted inputs**:
- Single PDF file
- Multiple PDF files (multi-select)
- ZIP archive chứa PDF files
- Mixed (ZIP + loose files trong cùng 1 lần upload)

**Preprocessing logic**:
1. Giải nén ZIP (nếu có) — chỉ extract file .pdf, bỏ qua file khác
2. Validate mỗi file: phải là PDF hợp lệ, size ≤ 20MB, số trang ≤ 10
3. Tạo batch job: gom tất cả files vào 1 batch, gán batch_id, timestamp, user_id
4. File lưu vào folder `data/uploads/{batch_id}/{filename}`

**Upload modes** (frontend-assisted classification):

| Mode | UI | Backend behavior |
|------|-----|-----------------|
| **Specific NCC** | User chọn NCC từ dropdown (autocomplete) | Skip AI classification, chỉ extract + validate theo schema NCC đó |
| **Mixed batch** | User chọn "Tổng hợp nhiều NCC" | Auto-classify bằng fingerprint, LLM fallback cho unmatched |
| **New/Unknown** | User chọn "NCC mới / Không chắc chắn" | Full AI pipeline + queue cho Configurator |

**Batch Template** (optional enhancement):
- Operator tạo preset: tên template + expected NCC list + default behavior
- Lần sau chỉ chọn template → upload → skip NCC selection

**Error handling**:
- File không phải PDF → reject, hiển thị tên file + lý do
- File corrupt → reject
- ZIP chứa nested ZIP → chỉ extract level 1
- Tổng số file > 500 / batch → cảnh báo, yêu cầu chia nhỏ

### 3.2 F02 — OCR & Extraction Pipeline

**Description**: Hệ thống gửi PDF đến Gemini Flash API để OCR và extract structured data.

**Pipeline**:

```
PDF file
  ↓
[Check cache] — Nếu file hash đã process trước đó → return cached result
  ↓
[Convert] — PDF pages → images (nếu cần, Gemini hỗ trợ native PDF)
  ↓
[OCR + Extract] — Gửi Gemini Flash với prompt template
  ↓
[Parse response] — Validate JSON output, check completeness
  ↓
[Store] — Lưu raw OCR text + extracted JSON vào DB
```

**Prompt strategy**:

- **Khi đã biết schema** (user chọn NCC hoặc fingerprint match): prompt cố định per schema, chỉ yêu cầu extract các fields đã define. Prompt ngắn, output JSON schema cố định. Chi phí thấp nhất.
- **Khi chưa biết schema**: prompt generic, yêu cầu extract tất cả fields phổ biến + classify loại HĐ. Prompt dài hơn, output flexible.

**Gemini Flash prompt template (known schema) — ví dụ**:

```
Extract the following fields from this Vietnamese invoice PDF.
Return ONLY valid JSON, no explanation.

Required fields:
{schema.fields_definition}

Output format:
{schema.json_template}

Additional rules:
- All monetary values as integers (VND, no decimals)
- Date format: YYYY-MM-DD
- Tax ID format: 10 digits or 13 digits (10-3)
- If a field is not found, set to null
- For line_items, extract ALL rows
- Include a "confidence" field (0.0 to 1.0) for each extracted field
```

**Cost estimate**:
- Gemini 2.0 Flash: ~$0.003/page
- Average invoice 1 page: $0.003 per invoice
- 1000 invoices/day: ~$3/day
- With cache hit (duplicate uploads): effectively lower

### 3.3 F03 — Classification & Fingerprinting

**Description**: Xác định loại hóa đơn (thuộc schema nào) bằng code-based rules trước, AI fallback sau.

**Fingerprint matching (code-based, zero AI cost)**:

Priority order:
1. **MST bên bán** — match exact → xác định NCC → xác định schema
2. **Ký hiệu HĐ pattern** — regex match → phân biệt variant/version schema của cùng NCC
3. **Keyword detection** — tên NCC trong header, specific keywords
4. **Layout signature** — số cột trong bảng line items, vị trí tổng cộng

**Decision matrix**:

| Frontend hint | Fingerprint match | Action |
|---------------|------------------|--------|
| User chọn NCC X | Match NCC X | ✅ Extract theo schema X (highest confidence) |
| User chọn NCC X | Match NCC Y (khác!) | ⚠️ Flag conflict, queue review |
| User chọn NCC X | No match | ⚠️ Extract theo schema X nhưng validation strict hơn |
| Mixed batch | Match NCC X | ✅ Extract theo schema X |
| Mixed batch | No match | 🤖 Gọi LLM classify |
| New/Unknown | Any | 🤖 Full AI pipeline + queue Configurator |

**Confidence scoring** (composite):

```
final_confidence =
  0.3 × frontend_hint_score     (1.0 nếu user chọn đúng, 0.5 nếu mixed, 0.0 nếu unknown)
+ 0.4 × fingerprint_score       (1.0 nếu MST match, 0.7 nếu keyword only, 0.0 nếu no match)
+ 0.3 × extraction_validation   (1.0 nếu tất cả field valid, giảm dần theo số field lỗi)
```

**Routing**:

| Confidence | Action |
|-----------|--------|
| ≥ 0.85 | Auto-process theo behavior config |
| 0.60 — 0.84 | Queue for Operator review (hiển thị suggestion) |
| < 0.60 | Queue for Configurator review |

### 3.4 F04 — Validation Layer

**Description**: Sau extraction, validate dữ liệu bằng business rules. Chạy hoàn toàn bằng code, không tốn AI.

**Field-level validations**:

| Field | Rules |
|-------|-------|
| invoice_number | Required, non-empty, unique per (invoice_symbol + seller_tax_id) |
| invoice_symbol | Required, non-empty |
| invoice_date | Required, valid date, not future, not older than 6 months (configurable) |
| seller_tax_id | Required, format: 10 digits or 13 digits (pattern: `^\d{10}(-\d{3})?$`) |
| buyer_tax_id | Required, same format |
| subtotal | Required, integer ≥ 0 |
| vat_rate | Must be in {0, 5, 8, 10} |
| vat_amount | Must equal subtotal × vat_rate / 100 (± 1 VND tolerance) |
| total | Must equal subtotal + vat_amount (± 1 VND tolerance) |
| line_items | At least 1 item, each must have: name, quantity > 0, unit_price ≥ 0 |
| line_items_sum | Sum of line item amounts must equal subtotal (± configurable tolerance) |

**Cross-invoice validations**:
- Duplicate check: same (invoice_symbol + invoice_number + seller_tax_id) → flag
- Same file hash → flag (exact duplicate upload)

**Field-level confidence**:
- Mỗi field extracted từ Gemini đã có confidence score
- Sau validation, nếu field fail rule → confidence set to 0
- UI highlight fields theo confidence: green (≥0.9), yellow (0.7-0.9), red (<0.7)

### 3.5 F05 — Schema Management (Configurator)

**Description**: Configurator tạo và quản lý schema cho từng loại hóa đơn / NCC.

**Schema definition**:

```
Schema:
  - id: auto-generated UUID
  - name: "Digiworld VAT Invoice"
  - description: "Hóa đơn GTGT từ Chi nhánh Công ty Cổ phần Thế Giới Số"
  - ncc_name: "Digiworld"
  - ncc_tax_id: "0302861742-001"
  - status: active | testing | disabled
  - version: integer, auto-increment on edit
  - created_at, updated_at

  Fingerprint Rules:
    - rule_type: mst_exact | keyword_contains | symbol_regex | custom
    - rule_value: string
    - priority: integer (lower = higher priority)

  Field Definitions:
    - field_key: "invoice_number"
    - field_label: "Số hóa đơn"
    - data_type: string | integer | date | decimal | array
    - required: boolean
    - validation_regex: optional
    - extraction_hint: "Số :" (hint cho OCR prompt, vị trí thường gặp)

  Prompt Template:
    - auto-generated từ field definitions
    - editable (advanced mode, hidden by default)
    - version history

  Behavior Config:
    - on_high_confidence: show_web_only | export_csv | export_json | export_excel | push_webhook
    - on_medium_confidence: always "queue_for_review"
    - on_low_confidence: always "queue_for_configurator"
    - webhook_url: optional (for ERP push, future phase)
    - export_template: optional (custom column mapping for export)

  Sample Files:
    - uploaded PDF files used for testing
    - stored with schema for reference
```

**Schema creation wizard** (step-by-step):

1. **Basic Info**: Tên NCC, MST, mô tả
2. **Upload Samples**: Tối thiểu 1 file PDF mẫu
3. **Interactive Field Mapper**: Hiển thị OCR result, Configurator đánh dấu fields
4. **Fingerprint Setup**: Auto-suggest rules từ MST + ký hiệu, Configurator confirm/edit
5. **Behavior**: Chọn action cho mỗi confidence level (default: show_web_only cho schema mới)
6. **Test Run**: Chạy sample files qua schema mới → hiển thị kết quả → Configurator verify
7. **Activate**: Schema sẵn sàng sử dụng

**Schema lifecycle**:

```
[Draft] → test run OK → [Testing] → Configurator activate → [Active]
                                                                ↓
                                      Format thay đổi → [Clone] → [Draft] (version mới)
                                                                ↓
                                      Không dùng nữa → [Disabled] (giữ history, không delete)
```

**Shadow Mode** (advanced):
- Khi clone schema, cho phép chạy song song: schema cũ (production) + schema mới (shadow)
- Cùng 1 file → 2 kết quả → so sánh trên UI
- Configurator quyết định switch khi đủ tin tưởng

### 3.6 F06 — Viettel Product Master

**Description**: Quản lý danh mục sản phẩm Viettel, sync từ API.

**Data model**:

```
ViettelProduct:
  - id: auto-generated
  - product_code: "LOA-XM-OUTDOOR-30W" (unique)
  - product_name: "Loa Bluetooth Xiaomi Sound Outdoor 30W"
  - category: "Loa Bluetooth"
  - status: active | inactive | discontinued
  - synced_at: timestamp
  - version: integer (increment on change)
  - raw_api_data: JSON (full response from API for audit)
```

**Sync mechanism**:
- Manual: nút "Sync Now" trên UI
- Auto: configurable schedule (default: mỗi 6 giờ)
- API endpoint configurable trong config file
- MVP: mock API server built-in, trả sample data

**Conflict detection on sync**:

| Change type | Detection | Action |
|-------------|-----------|--------|
| Tên đổi | product_code same, name different | Flag "Name changed", show old vs new |
| Mã đổi | name same, code different | Flag "Code changed", high priority |
| SP mới | code not in DB | Auto-add, flag "New product" |
| SP bị xóa | code in DB, not in API response | Flag "Product removed", DO NOT auto-delete |
| Không đổi | exact match | No action |

**Conflict resolution** (Configurator):
- Mỗi conflict hiển thị: old value vs new value + affected mappings
- Options: "Accept change" / "Ignore" / "Manual resolve"
- Nếu accept change ảnh hưởng mapping → cascade update mapping + flag affected invoices

### 3.7 F07 — Mapping Master

**Description**: Bảng ánh xạ sản phẩm đối tác ↔ sản phẩm Viettel.

**Data model**:

```
ProductMapping:
  - id: auto-generated
  - source_product_name: "Xiaomi Sound Outdoor 30W Vàng (QBH4370GL)"
  - source_product_code: optional
  - source_ncc_tax_id: "0302861742-001" (scope mapping theo NCC)
  - target_product_id: FK → ViettelProduct
  - match_type: exact | fuzzy | manual
  - confidence: decimal (for auto-suggested mappings)
  - status: active | disabled
  - created_by: user or system
  - created_at, updated_at
```

**Mapping creation flows**:

1. **Manual**: Configurator mở Mapping Master → "Thêm mới" → gõ tên SP đối tác → search/select SP Viettel
2. **From review queue**: Operator gặp line item unmapped → forward to Configurator → Configurator create mapping ngay từ review screen
3. **Auto-suggest**: Khi extract line item mới, system fuzzy-match tên SP đối tác với tên SP Viettel → suggest top 3 candidates → Configurator/Operator confirm
4. **Bulk import**: Upload Excel file có 2 cột (tên SP đối tác, mã SP Viettel)
5. **Implicit learning**: Khi Operator sửa mapping trong review → hệ thống hỏi "Áp dụng cho tất cả?" → tạo mapping rule

**Fuzzy matching algorithm** (code-based, không AI):
- Normalize text: lowercase, remove diacritics, remove common words ("cái", "chiếc", "bộ")
- Token-based similarity (Jaccard / Levenshtein)
- Bonus score nếu brand name match (Xiaomi, Samsung, Apple...)
- Threshold configurable (default 0.7 similarity → suggest)

### 3.8 F08 — Review Queue & Approval

**Description**: Giao diện cho Operator review các HĐ cần human verification.

**Queue structure**:

```
Review Queue:
  ├── By confidence level
  │   ├── Medium (Operator review)
  │   └── Low / Unknown (Configurator review)
  ├── By issue type
  │   ├── Extraction uncertain
  │   ├── Mapping not found
  │   ├── Validation failed
  │   ├── Duplicate detected
  │   ├── NCC conflict (frontend hint ≠ fingerprint)
  │   └── Unknown type
  └── By batch / date / NCC
```

**Review screen layout**:

```
┌─────────────────────────────────────────────────────────────┐
│ [PDF Viewer - bên trái]          │ [Extracted Data - bên phải] │
│                                   │                             │
│  Render PDF gốc                  │  Invoice #: 80321           │
│  (scroll, zoom)                  │  Date: 2026-04-07           │
│                                   │  Seller: Digiworld ✅       │
│  Click field bên phải            │  Tax ID: 0302861742 ✅      │
│  → highlight vùng tương ứng     │  Subtotal: 881,900 ✅       │
│  trên PDF                        │  VAT (8%): 70,552 ✅        │
│                                   │  Total: 952,452 ✅          │
│                                   │                             │
│                                   │  Line Items:                │
│                                   │  1. Xiaomi Sound... ✅      │
│                                   │     → LOA-XM-OUT... ✅      │
│                                   │                             │
│                                   │  [Approve] [Edit] [Reject]  │
└─────────────────────────────────────────────────────────────┘
```

**Actions**:

| Action | Effect |
|--------|--------|
| Approve | Process theo behavior config, move to Completed |
| Edit & Approve | Operator sửa field → hệ thống hỏi "Lưu làm mapping mới?" → Approve |
| Reject | Ghi lý do (dropdown + free text) → move to Rejected |
| Forward | Chuyển cho Configurator (nếu cần tạo schema/mapping mới) |
| Skip | Tạm bỏ qua, giữ trong queue |

**Bulk actions**:
- Select nhiều items → Approve All / Reject All
- Filter → Select All Visible → Bulk action

### 3.9 F09 — Dashboard & Monitoring

**Description**: Trang chính hiển thị trạng thái hệ thống và kết quả xử lý.

**Operator Dashboard**:

```
┌──────────────────────────────────────────────────┐
│ 📊 Hôm nay: 2026-04-07                          │
│                                                    │
│  Đã upload: 1,024 files    Processing: 12          │
│  ✅ Auto OK: 890 (87%)     ⚠️ Cần review: 98      │
│  ❌ Lỗi: 24               📋 Chờ Configurator: 12  │
│                                                    │
│ [Notifications]                                    │
│  🔔 3 hóa đơn duplicate detected          [Xem →] │
│  🔔 5 sản phẩm chưa có mapping           [Xem →] │
│  🔔 1 file corrupt                        [Xem →] │
│                                                    │
│ [Recent Batches]                                   │
│  Batch #45 - 50 files - Digiworld - 98% OK  [→]   │
│  Batch #44 - 30 files - Samsung - 100% OK    [→]   │
│  Batch #43 - 120 files - Mixed - 85% OK     [→]   │
│                                                    │
│ [Quick Upload]                                     │
│  [Select NCC ▼] [Choose files] [Upload]            │
└──────────────────────────────────────────────────┘
```

**Notifications**:
- In-app notification bell với badge count
- Click notification → navigate trực tiếp đến item/queue tương ứng
- Notification types: error, warning, info
- Auto-refresh dashboard mỗi 30 giây (configurable)

**Diagnostic Dashboard** (Technical Support):

```
┌──────────────────────────────────────────────────┐
│ 🔧 System Diagnostics                            │
│                                                    │
│ API Status:                                        │
│  Gemini API: ✅ Online (avg 1.2s/call)             │
│  Viettel Product API: ✅ Online (last sync 2h ago) │
│                                                    │
│ Storage:                                           │
│  Disk usage: 2.4 GB / 50 GB                       │
│  SQLite size: 45 MB                                │
│  Upload folder: 2.1 GB (1,204 files)              │
│                                                    │
│ Performance (today):                               │
│  Avg processing time: 2.1s / file                  │
│  API calls: 1,024 OCR + 12 LLM classify           │
│  Estimated cost: $3.18                             │
│                                                    │
│ Schema Health:                                     │
│  Digiworld: 98% success (↑2% vs last week)        │
│  Samsung: 95% success (→ stable)                   │
│  NewNCC: 72% success ⚠️ (needs attention)          │
│                                                    │
│ [View Logs] [View Config] [Export Diagnostics]     │
└──────────────────────────────────────────────────┘
```

**Per-invoice tracing**:
- Click vào bất kỳ invoice → xem full trace:
  - Step 1: Upload (timestamp, user, batch)
  - Step 2: Preprocessing (file validation, size, pages)
  - Step 3: OCR (Gemini request/response, duration, cost)
  - Step 4: Classification (fingerprint result, LLM result if any)
  - Step 5: Extraction (parsed JSON, field-level confidence)
  - Step 6: Validation (pass/fail per rule)
  - Step 7: Matching (PO match result, mapping used)
  - Step 8: Action (export/sync/review, final status)

### 3.10 F10 — Export & Post-processing

**Description**: Sau khi HĐ đã processed, thực hiện action theo behavior config.

**Export formats**:

| Format | Description |
|--------|-------------|
| Show on web | Hiển thị kết quả trên UI, không export file |
| CSV | Standard CSV, UTF-8 with BOM (Excel-compatible Vietnamese) |
| JSON | Structured JSON, 1 file per batch |
| Excel | .xlsx với formatting, header row, auto-width columns |

**Export scope**:
- Single invoice
- Batch (all invoices in a batch)
- Filtered (by date range, NCC, status)
- Custom query (Configurator)

**Future phase — Webhook/ERP push**:
- POST structured JSON to configurable endpoint
- Retry logic (3 retries, exponential backoff)
- Status tracking: pushed / failed / retrying
- MVP: interface defined, implementation deferred

### 3.11 F11 — Duplicate Detection

**Description**: Phát hiện HĐ trùng lặp trước khi process.

**Detection keys**:
- **Exact duplicate**: same file hash (SHA-256) → same physical file
- **Logical duplicate**: same (invoice_symbol + invoice_number + seller_tax_id) → same invoice from different source/scan

**Behavior on detection**:
- Block auto-processing
- UI hiển thị cảnh báo + link đến record cũ
- Operator options: "Skip (trùng thật)" / "Process anyway (HĐ điều chỉnh)" / "Flag & skip"

### 3.12 F12 — Hóa đơn điều chỉnh / Thay thế

**Description**: Xử lý HĐ đặc biệt theo quy định VN.

**Detection**: Keyword-based trong OCR text: "ĐIỀU CHỈNH", "THAY THẾ", "HỦY"

**Behavior**:
- Auto-link đến HĐ gốc (qua số HĐ reference + MST)
- UI hiển thị quan hệ: HĐ điều chỉnh → HĐ gốc
- Operator verify relationship → approve

### 3.13 F13 — Confidence Analytics (Configurator)

**Description**: Dashboard thống kê chất lượng schema theo thời gian.

**Metrics per schema**:
- % auto-match (high confidence) — trend 7/30 ngày
- % cần review — trend
- % fail — trend
- Average confidence score — trend
- Top failed validation rules

**Alerts**:
- Schema confidence drop >10% trong 3 ngày → alert Configurator
- Tỷ lệ unknown type tăng đột biến → alert

---

## 4. Non-functional Requirements

### 4.1 Deployment
- Single machine, localhost
- Prerequisite: Node.js (LTS) only
- Setup: 1 script (`npm run setup`)
- Config: 1 file text (`config.env`)
- Start: 1 command (`npm start`)
- Monorepo: frontend + backend + mock server

### 4.2 Performance
- Handle 5 concurrent users uploading
- Process 1000 files/day (not necessarily concurrent — spread across day)
- Per-file processing: ≤ 5 seconds average (dominated by API call)
- UI response: ≤ 500ms for any page load (local data)
- Batch progress: real-time update via polling or SSE

### 4.3 Data & Storage
- SQLite database (single file, no external DB server)
- PDF files stored on local filesystem
- No data size limit for MVP, but dashboard shows disk usage
- All history retained (no auto-cleanup in MVP)

### 4.4 Security (MVP scope)
- No authentication (localhost, trusted network)
- API keys stored in config file (not in DB)
- No encryption at rest

### 4.5 Reliability
- Must have internet connection (for Gemini API)
- If API fails: retry 3 times → mark as failed → Operator can retry manually
- Queue must survive server restart (persisted in SQLite)
- No data loss on crash (SQLite WAL mode)

---

## 5. Out of Scope (MVP Phase 1)

- User authentication & authorization (beyond UI-level hiding)
- ERP integration (push to ERP) — interface defined, not implemented
- PO matching detail logic — placeholder, detailed in Phase 2
- Multi-currency support
- Email integration (auto-ingest from email)
- Mobile responsive design
- Multi-language UI (Vietnamese only)
- Data encryption
- Automated backup
- Rate limiting
- API documentation (external)
