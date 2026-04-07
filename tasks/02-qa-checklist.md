# Q&A Checklist — Invoice Processing Tool MVP

**Purpose**: Comprehensive checklist of questions, decisions, and assumptions. Items marked ✅ are resolved. Items marked ❓ need follow-up. Items marked 💡 are assumptions made — to be validated.

---

## 1. Business & Scope

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 1.1 | Scope | Tổng số NCC ban đầu? | ✅ | ~10 types schema |
| 1.2 | Scope | Số lượng files / ngày? | ✅ | ~1000 files, batch upload |
| 1.3 | Scope | Số users đồng thời? | ✅ | ~5 |
| 1.4 | Scope | Chỉ hóa đơn GTGT hay bao gồm các loại chứng từ khác? | ❓ | 💡 Assume chỉ HĐ GTGT |
| 1.5 | Scope | Có xử lý hóa đơn giấy scan không (quality kém)? | ❓ | 💡 Assume chỉ HĐ điện tử PDF (text-based hoặc image-based nhưng quality tốt) |
| 1.6 | Scope | Ngôn ngữ hóa đơn? Chỉ tiếng Việt? | ❓ | 💡 Assume tiếng Việt only |
| 1.7 | Scope | Có cần xử lý HĐ đầu vào bằng XML (ngoài PDF) không? | ❓ | Image trong spec ban đầu mention PDF/XML. MVP focus PDF only? |
| 1.8 | Priority | MVP feature priority nếu phải cắt scope? | ❓ | 💡 Core: Upload → OCR → Extract → Review → Export. Secondary: Schema wizard, mapping auto-suggest, analytics |
| 1.9 | Scope | PO matching detail? | ✅ | Deferred to Phase 2. MVP chỉ extract PO number nếu có trên HĐ. |
| 1.10 | Scope | ERP push? | ✅ | Deferred. MVP: show web + export file |

## 2. OCR & AI

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 2.1 | AI Model | Gemini Flash model version cụ thể? | ❓ | 💡 gemini-2.0-flash-lite hoặc gemini-2.0-flash. Cần benchmark cả 2 với sample invoices |
| 2.2 | AI Model | Cần backup model nếu Gemini down? | ❓ | 💡 MVP: no backup. Retry + queue for later |
| 2.3 | AI Cost | Budget cap per day/month? | ❓ | 💡 Target ≤$5/day. Nếu vượt, alert trên dashboard |
| 2.4 | AI | Gemini rate limit? Có ảnh hưởng batch 1000 files? | ❓ | 💡 Gemini Flash: 1500 RPM free tier, 4000 RPM paid. 1000 files < 1500 RPM nên OK nếu spread qua vài phút. Cần implement rate limiter client-side |
| 2.5 | OCR | Multi-page invoice: gửi tất cả pages 1 request hay mỗi page riêng? | ❓ | 💡 Gửi tất cả pages 1 request (Gemini hỗ trợ). Nếu >5 pages, split |
| 2.6 | OCR | Có cần lưu raw OCR text riêng (ngoài extracted JSON) cho audit? | ✅ | Có, lưu cả raw text |
| 2.7 | AI | Prompt template có version control không? | 💡 | Có, mỗi lần Configurator sửa prompt → lưu version. Rollback nếu cần |
| 2.8 | AI | Nếu Gemini trả JSON invalid? | 💡 | Retry 1 lần. Nếu vẫn fail → mark as extraction_error → queue review |
| 2.9 | AI | Có cache OCR result per file hash? | ✅ | Có. Same file upload lại → return cached result, không gọi AI |
| 2.10 | AI | LLM cho classification khi unknown type — model nào? | ❓ | 💡 Dùng luôn Gemini Flash, 1 call vừa OCR vừa classify. Không cần model riêng |

## 3. Schema & Configuration

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 3.1 | Schema | Schema field definitions có standard set không? Hay hoàn toàn custom per NCC? | ❓ | 💡 Có base template (số HĐ, ngày, MST bên bán, MST bên mua, tổng tiền, VAT, line items) — tất cả schema kế thừa. Mỗi schema thêm custom fields nếu cần |
| 3.2 | Schema | Một NCC có thể có nhiều schema (nhiều format HĐ) không? | 💡 | Có. Ví dụ: Digiworld format 2025 vs Digiworld format 2026 |
| 3.3 | Schema | Schema bị disable → HĐ cũ đã process theo schema đó có ảnh hưởng? | 💡 | Không. Disable chỉ ảnh hưởng processing mới. History giữ nguyên |
| 3.4 | Schema | Có cần schema versioning diff view (xem thay đổi giữa versions)? | ❓ | 💡 MVP: chỉ lưu version number + timestamp. Diff view Phase 2 |
| 3.5 | Schema | Behavior config có thể khác nhau theo confidence level? | ✅ | Có: high → configurable action, medium → review, low → configurator |
| 3.6 | Schema | Khi Configurator đang edit schema, Operator upload vào schema đó? | 💡 | Schema edit là draft cho đến khi save. Processing dùng last saved version |
| 3.7 | Config | Confidence thresholds có configurable per schema không? | ❓ | 💡 MVP: global thresholds. Per-schema Phase 2 |
| 3.8 | Config | Export template customizable? Operator chọn columns nào export? | ❓ | 💡 MVP: fixed template per schema. Custom export Phase 2 |

## 4. Mapping & Products

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 4.1 | Mapping | 1 SP đối tác có thể map vào nhiều SP Viettel? | ❓ | 💡 No. 1:1 mapping. Nếu ambiguous → Configurator chọn 1 |
| 4.2 | Mapping | 1 SP Viettel có thể được map từ nhiều SP đối tác? | 💡 | Có. Nhiều NCC cung cấp cùng 1 SP → map về cùng 1 mã Viettel |
| 4.3 | Mapping | Mapping scope per NCC hay global? | 💡 | Per NCC (scoped by seller_tax_id). "Xiaomi Sound Outdoor" từ Digiworld vs từ NCC khác có thể map khác nhau |
| 4.4 | Products | Viettel Product API response format? | ❓ | MVP: mock API, define interface. Real API integration Phase 2 |
| 4.5 | Products | Product sync frequency? | 💡 | Default 6h, configurable. Manual sync always available |
| 4.6 | Products | Nếu product bị xóa trên Viettel side, xử lý mapping hiện có? | 💡 | Mark product as "discontinued". Giữ mapping nhưng flag warning. Không auto-delete |
| 4.7 | Mapping | Bulk mapping import format? | ❓ | 💡 Excel: Column A = tên SP đối tác, Column B = mã SP Viettel, Column C = MST NCC |
| 4.8 | Mapping | Khi SP đối tác thay đổi tên nhỏ (thêm màu, size) → match mapping cũ? | ❓ | 💡 Fuzzy match với threshold. "Xiaomi Sound Outdoor 30W Vàng" vs "Xiaomi Sound Outdoor 30W Đen" → khác mapping? Cần Configurator define: match by product line hay exact variant |

## 5. Upload & Processing

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 5.1 | Upload | Max file size per PDF? | 💡 | 20MB |
| 5.2 | Upload | Max files per batch? | 💡 | 500 files. Recommend ≤200 for best UX |
| 5.3 | Upload | Max ZIP file size? | 💡 | 500MB |
| 5.4 | Upload | Nested ZIP? | 💡 | Extract level 1 only. Nested ZIP files skipped + warned |
| 5.5 | Upload | Non-PDF files trong ZIP? | 💡 | Skipped, warning in batch result |
| 5.6 | Processing | Concurrency: bao nhiêu files process song song? | ❓ | 💡 5 concurrent Gemini API calls (respect rate limit). Queue the rest |
| 5.7 | Processing | Nếu server restart giữa batch? | 💡 | Unprocessed files remain in queue (persisted in SQLite). Resume on restart |
| 5.8 | Processing | Cancel batch đang chạy? | ❓ | 💡 MVP: yes, cancel unprocessed files. Already-processed files kept |
| 5.9 | Processing | Priority queue (batch VIP cao hơn)? | 💡 | MVP: FIFO. Priority Phase 2 |
| 5.10 | Upload | Same filename different content? | 💡 | OK — system uses file hash, not filename, for dedup |

## 6. Review & Approval

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 6.1 | Review | Operator sửa field → có ghi log ai sửa gì? | 💡 | Có. Audit trail: field_name, old_value, new_value, user, timestamp |
| 6.2 | Review | Reject HĐ → có thể re-process sau? | 💡 | Có. "Re-process" button → chạy lại OCR + extract |
| 6.3 | Review | Timeout cho review? HĐ nằm trong queue bao lâu? | ❓ | 💡 MVP: no timeout. Dashboard hiển thị aging (bao lâu trong queue) |
| 6.4 | Review | 2 users review cùng 1 HĐ? | 💡 | Last-write-wins. MVP không cần locking |
| 6.5 | Review | Undo approve (đã export rồi)? | 💡 | Có thể revert status. Exported file vẫn tồn tại (không auto-delete). |
| 6.6 | Review | Forward cho Configurator — notification mechanism? | 💡 | In-app notification. Configurator thấy badge count trên menu |

## 7. Export & Output

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 7.1 | Export | CSV encoding? | 💡 | UTF-8 with BOM (Vietnamese in Excel) |
| 7.2 | Export | Export tự động cho high-confidence hay cần click? | ❓ | 💡 Behavior config per schema: nếu set "auto export" → file tự generate, download link hiển thị. Nếu "show on web" → không export |
| 7.3 | Export | Export aggregation? 1 file per invoice hay 1 file per batch? | ❓ | 💡 Default: 1 file per batch (all invoices in 1 CSV). Option: per invoice |
| 7.4 | Export | Filename convention? | 💡 | `{schema_name}_{batch_id}_{date}.csv` |
| 7.5 | Export | Export history? Có lưu lại files đã export? | 💡 | Có. Stored in export folder, link on UI |

## 8. Infrastructure & Deployment

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 8.1 | Deploy | Target OS? | ❓ | 💡 Windows 10+ (primary — phòng ban dùng Windows). macOS/Linux secondary |
| 8.2 | Deploy | Node.js version requirement? | 💡 | Node.js 20 LTS |
| 8.3 | Deploy | Port conflicts? Multiple instances trên cùng máy? | 💡 | Default port 3000. Configurable in config.env |
| 8.4 | Deploy | Auto-start khi máy tính bật? | ❓ | 💡 MVP: manual start. Hướng dẫn tạo shortcut/bat file |
| 8.5 | Deploy | Update mechanism? | ❓ | 💡 MVP: tải zip mới, chạy lại setup. Database giữ nguyên (migration script) |
| 8.6 | Deploy | Backup database? | ❓ | 💡 MVP: manual copy SQLite file. Dashboard show button "Download backup" |
| 8.7 | Storage | Disk space estimate for 1 year operation? | 💡 | ~1000 PDFs/day × 1MB avg × 365 days ≈ 365GB. Cần planning cleanup policy |
| 8.8 | Network | Proxy / firewall? Offices có block API calls? | ❓ | Cần verify Gemini API accessible từ mạng nội bộ |
| 8.9 | Config | Sensitive config (API keys) có cần encrypt? | 💡 | MVP: plaintext in config.env. File-level permission only |

## 9. Edge Cases & Error Handling

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 9.1 | Error | Gemini API quota exceeded? | 💡 | Alert on dashboard + pause processing. Resume when quota reset |
| 9.2 | Error | Invalid API key? | 💡 | Health check on startup. Error message on dashboard |
| 9.3 | Error | PDF has images only (scanned), not text? | 💡 | Gemini Flash handles image-based PDF via vision. No special handling needed |
| 9.4 | Error | PDF is password-protected? | 💡 | Reject with message "File bị khóa mật khẩu" |
| 9.5 | Error | PDF has 0 pages? | 💡 | Reject with message "File rỗng" |
| 9.6 | Error | Gemini returns partial data (some fields missing)? | 💡 | Accept partial. Missing fields = null. Confidence lowered. Validation flags |
| 9.7 | Edge | Invoice with 0 VND total (free/warranty)? | ❓ | 💡 Accept. Validation allows total = 0 |
| 9.8 | Edge | Invoice in landscape orientation? | 💡 | Gemini handles orientation. No preprocessing needed |
| 9.9 | Edge | Very large table (>50 line items)? | ❓ | 💡 Accept. May span multi-page. Gemini extracts all |
| 9.10 | Edge | HĐ có cả tiếng Việt và tiếng Anh (product names)? | 💡 | OK. Gemini multilingual. Common with tech products |

## 10. UX & Usability

| # | Category | Question | Status | Answer/Assumption |
|---|----------|----------|--------|-------------------|
| 10.1 | UX | Ngôn ngữ UI? | 💡 | Tiếng Việt |
| 10.2 | UX | Dark mode? | 💡 | MVP: no. Light mode only |
| 10.3 | UX | Keyboard shortcuts cho review? | ❓ | 💡 Nice-to-have: A = Approve, R = Reject, → = Next |
| 10.4 | UX | Drag & drop upload? | 💡 | Có. Primary interaction |
| 10.5 | UX | Progress indication khi processing batch? | 💡 | Real-time: progress bar + count (12/50 files) |
| 10.6 | UX | Help / onboarding / tooltips? | ❓ | 💡 MVP: tooltips trên các nút chính. User guide Phase 2 |
| 10.7 | UX | PDF viewer cần zoom, scroll, rotate? | 💡 | Zoom + scroll. Rotate nice-to-have |
| 10.8 | UX | Mobile support? | ✅ | No. Desktop web only |
| 10.9 | UX | Browser support? | 💡 | Chrome latest. Others best-effort |
| 10.10 | UX | Notification sound? | ❓ | 💡 MVP: no sound. Visual notification only |
