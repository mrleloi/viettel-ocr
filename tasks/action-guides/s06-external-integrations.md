# Action Guide: Session 6 — External Integrations (GeminiClient + ViettelClient + FileStorage)

> Created: 2026-04-07 | Created by: Antigravity (Developer)
> Phase Step: 2.2 (from master plan § 7 Session Plan)
> Target Agent: Developer

---

## 0. Pre-Flight Checklist

Before starting, verify:
- [ ] Previous session completed: Session 5 — Database Repositories → check `.context/session-handoff.md`
- [ ] Build passing: `npx tsc --noEmit` (from `packages/backend/`) → 0 errors
- [ ] Tests passing: `npx jest --bail` (from `packages/backend/`) → all 246 green
- [ ] Required files exist:
  - `packages/backend/src/infrastructure/config/env-config.service.ts` — EnvConfigService with `geminiApiKey`, `viettelProductApiUrl`, `apiRetryCount`, `dataDir`
  - `packages/backend/src/infrastructure/database/database.module.ts` — All 8 repos registered
  - `packages/backend/src/domain/` — All 8 entities, 3 VOs, 5 domain services, 8 repo interfaces

**If any check fails → STOP. Fix before proceeding.**

---

## 1. Context

### Business Requirement

The processing pipeline needs 3 external integrations:
1. **Gemini Flash API** for OCR + extraction of invoice PDFs (F02 — OCR & Extraction Pipeline)
2. **Viettel Product API** client to fetch/sync product master data (F06 — Viettel Product Master)
3. **Local file storage** for saving uploaded PDFs and exported files (F01 — File Upload)

Reference: `tasks/01-business-spec.md` § F01, F02, F06

### Architecture Context

These are infrastructure-layer implementations. The domain layer defines WHAT it needs (interfaces), and this session's code provides HOW (concrete implementations).

```
Domain Interface (ports)           →  Infrastructure Implementation (adapters)
─────────────────────────────────────────────────────────────────────────────
IOcrService                        →  GeminiClient
IProductApiClient                  →  ViettelProductClient
IFileStorage                       →  LocalFileStorage
```

Reference: `tasks/06-low-level-design.md` § 1 (infrastructure/ai/, infrastructure/external-api/, infrastructure/file-storage/)

### Database Tables Involved

| Table | Purpose in this session |
|-------|----------------------|
| (none) | This session is HTTP/file I/O only — no DB tables touched directly |

### Data Flow

- GeminiClient: Used in Stage 4 (OCR + Extract) of primary flow
- ViettelProductClient: Used in Secondary Flow 4 (Product Sync)
- LocalFileStorage: Used in Stage 1 (Intake — file save) and Stage 8 (Export — file generation)

Reference: `tasks/05-data-flow-design.md` § 1 (Stage 4), § 4 (Product Sync)

---

## 2. Mandatory Reading

> ⚠️ Read ALL of these BEFORE writing any code.

### Skills (read in order)
1. `.agents/skills/gemini-integration/skill.md` — Gemini API pattern, retry logic, prompt strategy
2. `.agents/skills/bdd-test-writing/skill.md` — Integration test structure with mocked HTTP
3. `.agents/skills/quality-self-check/skill.md` — Verification before completion

### Workflows (follow this one)
- `.agents/workflows/session-handoff.md` — Session lifecycle (orient → plan → implement → verify → handoff)

### Relevant Learned Rules
- Domain services use plain data interfaces — infrastructure adapts to these
- `@Inject(TOKEN)` for NestJS DI wiring
- OS is Windows + PowerShell — do not use bash syntax in commands
- `npx jest` must run from `packages/backend/` directory, never from monorepo root
- Jest 29.x must be used (not 30) — ts-jest compatibility

---

## 3. Tasks (Ordered)

### Task 1: Define Domain Port Interfaces

**Type**: GREEN (create interfaces in domain layer)

Create the domain-side port interfaces that external integrations implement.

#### Task 1a: IOcrService
**File**: `packages/backend/src/domain/processing/ocr.service.ts`

```typescript
export interface OcrExtractionResult {
  /** Raw OCR text from the PDF */
  rawText: string;
  /** Structured extracted data as key-value pairs */
  extractedData: Record<string, unknown>;
  /** Per-field confidence scores (0.0-1.0) */
  fieldConfidences: Record<string, number>;
  /** Classification result (only for unknown schema mode) */
  classification?: {
    schemaName: string;
    confidence: number;
    reason: string;
  };
}

export interface IOcrService {
  /**
   * Extract structured data from a PDF using a known schema prompt.
   * @param pdfBase64 - Base64-encoded PDF file
   * @param promptTemplate - Schema-specific extraction prompt
   * @returns Extraction result with structured data and confidence scores
   */
  extract(pdfBase64: string, promptTemplate: string): Promise<OcrExtractionResult>;

  /**
   * Extract and classify a PDF against known schemas.
   * Used when schema is unknown (mixed/new upload mode).
   * @param pdfBase64 - Base64-encoded PDF file
   * @param schemaList - List of known schemas for classification
   * @returns Extraction result with classification info
   */
  extractAndClassify(
    pdfBase64: string,
    schemaList: Array<{ name: string; description: string; nccTaxId: string }>
  ): Promise<OcrExtractionResult>;
}
```

#### Task 1b: IProductApiClient
**File**: `packages/backend/src/domain/product/product-api.client.ts`

```typescript
export interface ProductApiItem {
  /** Product code (unique identifier from external API) */
  productCode: string;
  /** Product display name */
  productName: string;
  /** Product category */
  category: string;
  /** Product status */
  status: string;
  /** Raw API data for audit */
  rawData: Record<string, unknown>;
}

export interface ProductApiResponse {
  /** List of products */
  data: ProductApiItem[];
  /** Pagination info */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IProductApiClient {
  /**
   * Fetch products from external API with pagination.
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @param search - Optional search keyword
   * @returns Paginated product response
   */
  fetchProducts(page?: number, limit?: number, search?: string): Promise<ProductApiResponse>;

  /**
   * Fetch all products across all pages.
   * @returns All products from the API
   */
  fetchAllProducts(): Promise<ProductApiItem[]>;

  /**
   * Check if the API is reachable.
   * @returns true if healthy
   */
  healthCheck(): Promise<boolean>;
}
```

#### Task 1c: IFileStorage
**File**: `packages/backend/src/domain/shared/file-storage.ts`

```typescript
export interface IFileStorage {
  /**
   * Save a file to storage.
   * @param relativePath - Path relative to data dir (e.g., 'uploads/batch-1/invoice.pdf')
   * @param content - File content as Buffer
   */
  saveFile(relativePath: string, content: Buffer): Promise<void>;

  /**
   * Read a file from storage.
   * @param relativePath - Path relative to data dir
   * @returns File content as Buffer
   */
  readFile(relativePath: string): Promise<Buffer>;

  /**
   * Read a file and return as Base64 string.
   * @param relativePath - Path relative to data dir
   * @returns Base64-encoded file content
   */
  readFileAsBase64(relativePath: string): Promise<string>;

  /**
   * Check if a file exists.
   * @param relativePath - Path relative to data dir
   * @returns true if file exists
   */
  fileExists(relativePath: string): Promise<boolean>;

  /**
   * Delete a file.
   * @param relativePath - Path relative to data dir
   */
  deleteFile(relativePath: string): Promise<void>;

  /**
   * List files in a directory.
   * @param relativeDirPath - Directory path relative to data dir
   * @returns Array of filenames
   */
  listFiles(relativeDirPath: string): Promise<string[]>;

  /**
   * Ensure a directory exists (create if not).
   * @param relativeDirPath - Directory path relative to data dir
   */
  ensureDir(relativeDirPath: string): Promise<void>;
}
```

---

### Task 2: GeminiClient Implementation (RED → GREEN)

**Test**: `packages/backend/src/infrastructure/ai/__tests__/gemini.client.spec.ts`
**File**: `packages/backend/src/infrastructure/ai/gemini.client.ts`

**What to do**:

Implement `GeminiClient` that implements `IOcrService`. Uses `fetch()` to call Gemini API with retry logic.

**Test cases** (≥5):
1. ✅ `extract()` returns parsed extraction result on successful API call
2. ✅ `extract()` retries on 429 (rate limit) and succeeds on retry
3. ✅ `extract()` retries on 500 (server error) and succeeds on retry
4. ✅ `extract()` throws after max retries exceeded
5. ✅ `extract()` throws immediately on 400 (client error, no retry)
6. ✅ `extractAndClassify()` returns classification + extraction data
7. ✅ Response parsing handles malformed JSON gracefully

**Key patterns**:
- Mock `global.fetch` in tests — never call real API
- Use `EnvConfigService` for API key and retry count
- Retry: 429 → delay × 3^attempt; 500 → delay × 2^attempt; 4xx → no retry
- Parse response: `response.candidates[0].content.parts[0].text` → `JSON.parse()`
- Base delay: 1000ms

**Verify**: `npx jest --testPathPattern="gemini.client" --bail`

---

### Task 3: ViettelProductClient Implementation (RED → GREEN)

**Test**: `packages/backend/src/infrastructure/external-api/__tests__/viettel-product.client.spec.ts`
**File**: `packages/backend/src/infrastructure/external-api/viettel-product.client.ts`

**What to do**:

Implement `ViettelProductClient` that implements `IProductApiClient`. Calls configured Viettel Product API URL.

**Test cases** (≥5):
1. ✅ `fetchProducts()` returns paginated products
2. ✅ `fetchProducts()` passes search/page/limit query params
3. ✅ `fetchAllProducts()` paginates through all pages automatically
4. ✅ `healthCheck()` returns true when API responds with 200
5. ✅ `healthCheck()` returns false when API is unreachable
6. ✅ `fetchProducts()` throws with descriptive error on network failure

**Key patterns**:
- Mock `global.fetch` in tests
- Use `EnvConfigService.viettelProductApiUrl` as base URL
- `fetchAllProducts()` loops pages until `page >= totalPages`
- Map API response fields to `ProductApiItem` interface

**Verify**: `npx jest --testPathPattern="viettel-product" --bail`

---

### Task 4: LocalFileStorage Implementation (RED → GREEN)

**Test**: `packages/backend/src/infrastructure/file-storage/__tests__/local-storage.service.spec.ts`
**File**: `packages/backend/src/infrastructure/file-storage/local-storage.service.ts`

**What to do**:

Implement `LocalFileStorage` that implements `IFileStorage`. Uses Node.js `fs/promises` to manage files within `dataDir`.

**Test cases** (≥6):
1. ✅ `saveFile()` creates file and parent directories
2. ✅ `readFile()` returns file content as Buffer
3. ✅ `readFileAsBase64()` returns Base64-encoded content
4. ✅ `fileExists()` returns true for existing file, false for missing
5. ✅ `deleteFile()` removes file
6. ✅ `listFiles()` returns filenames in directory
7. ✅ `ensureDir()` creates nested directory structure
8. ❌ `readFile()` throws on non-existent file
9. ❌ Path traversal: rejects paths with `..` to prevent escape from data dir

**Key patterns**:
- Use a temp directory in tests (clean up in afterEach)
- Use `EnvConfigService.dataDir` as root
- All paths joined: `path.join(dataDir, relativePath)`
- Security: reject paths containing `..` to prevent directory traversal

**Verify**: `npx jest --testPathPattern="local-storage" --bail`

---

### Task 5: NestJS Module Registration

**Type**: GREEN (wiring)
**File**: `packages/backend/src/infrastructure/ai/ai.module.ts` (NEW)
**File**: `packages/backend/src/infrastructure/external-api/external-api.module.ts` (NEW)
**File**: `packages/backend/src/infrastructure/file-storage/file-storage.module.ts` (NEW)
**File**: `packages/backend/src/app.module.ts` (MODIFY — import new modules)

**What to do**:

Create NestJS modules for each integration and register them with DI tokens matching domain interface names:

```typescript
// ai.module.ts
const providers = [
  { provide: 'IOcrService', useClass: GeminiClient },
];

// external-api.module.ts
const providers = [
  { provide: 'IProductApiClient', useClass: ViettelProductClient },
];

// file-storage.module.ts
const providers = [
  { provide: 'IFileStorage', useClass: LocalFileStorage },
];
```

Import all 3 modules in `app.module.ts`.

---

## 4. Quality Gate

> ⚠️ **OS**: Windows + PowerShell. Do NOT use bash `&&` or `grep -r | wc -l`.

Run ALL of these before claiming done:

```powershell
# Build — from packages/backend/ directory
npx tsc --noEmit

# Tests — from packages/backend/ directory (OR `npm test` from monorepo root)
npx jest --bail
# ⚠️ NEVER run `npx jest` from monorepo root — no jest config there

# Architecture checks — use grep_search tool:
#   query "@nestjs" in packages/backend/src/domain/  → expect 0 results
#   query "drizzle-orm" in packages/backend/src/domain/  → expect 0 results
#   query ": any" in packages/backend/src/domain/  → expect 0 results
#   query "from.*infrastructure" (regex) in packages/backend/src/domain/  → expect 0 results
#   NEW: query "node:fs" in packages/backend/src/domain/  → expect 0 results
#   NEW: query "node-fetch" in packages/backend/src/domain/  → expect 0 results
```

**Pass criteria**: ALL commands succeed, 0 violations.

---

## 5. Acceptance Criteria

- [ ] 3 domain port interfaces created (IOcrService, IProductApiClient, IFileStorage)
- [ ] GeminiClient implemented with retry logic (429/500 retry, 4xx fail-fast)
- [ ] ViettelProductClient implemented with pagination support
- [ ] LocalFileStorage implemented with path traversal protection
- [ ] GeminiClient has ≥5 tests with mocked fetch
- [ ] ViettelProductClient has ≥5 tests with mocked fetch
- [ ] LocalFileStorage has ≥6 tests using temp directory
- [ ] 3 NestJS modules created and registered in app.module.ts
- [ ] All 246+ previous tests still pass (no regressions)
- [ ] New integration tests all pass
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] 0 framework imports in domain layer (architecture preserved)
- [ ] Session handoff updated
- [ ] Agent notes updated
- [ ] Progress tracker updated

---

## 6. Handoff

After completing this session:

1. Update `.context/session-handoff.md`:
   - Done: 3 domain port interfaces + 3 infrastructure implementations + tests + NestJS modules
   - Found: Any integration issues
   - What's Next: "Session 7: Phase Step 2.3 + 2.4a — Job Queue + Upload/Processing use cases"

2. Update `.context/agent-notes.md`:
   - Progress counters (external integrations count → 3 total)
   - Any fetch/HTTP testing patterns learned

3. Update `tasks/progress.md`:
   - Mark Step 2.2 as done

4. Create action guide for Session 7: `tasks/action-guides/s07-queue-usecases.md`

5. Commit: `feat: add external integration clients (Gemini, Viettel API, file storage)`

**Next session depends on**: All 3 external integration clients being available as injectable services for use cases (Session 7+).
