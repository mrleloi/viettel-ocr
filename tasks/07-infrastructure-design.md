# Infrastructure Design

**Version**: 1.0  
**Date**: 2026-04-07  

---

## 1. Deployment Architecture

```
┌──────────────────────────────────────────────────────┐
│                  User's Machine                       │
│                  (Windows / macOS / Linux)             │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Node.js Runtime (v20 LTS)           │ │
│  │                                                   │ │
│  │  ┌──────────────────┐  ┌───────────────────┐    │ │
│  │  │  Next.js Frontend │  │  NestJS Backend    │    │ │
│  │  │  (port 3001)      │  │  (port 3000)       │    │ │
│  │  │                    │  │                     │    │ │
│  │  │  Static assets     │  │  REST API          │    │ │
│  │  │  SSR pages         │  │  SSE endpoint      │    │ │
│  │  │  API proxy to BE   │  │  File serving      │    │ │
│  │  └──────────────────┘  │  Job queue worker   │    │ │
│  │                         │                     │    │ │
│  │  ┌──────────────────┐  │  ┌───────────────┐ │    │ │
│  │  │  Mock Server      │  │  │ SQLite DB      │ │    │ │
│  │  │  (port 3002)      │  │  │ (WAL mode)     │ │    │ │
│  │  │  Viettel Product  │  │  └───────────────┘ │    │ │
│  │  │  API simulation   │  └───────────────────┘    │ │
│  │  └──────────────────┘                             │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │              data/ (local filesystem)        │ │ │
│  │  │  ├── database.sqlite                         │ │ │
│  │  │  ├── uploads/{batch_id}/{files}.pdf           │ │ │
│  │  │  ├── exports/{export_id}/{files}.csv          │ │ │
│  │  │  └── logs/                                    │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Network: Outbound HTTPS only                        │
│  ├── https://generativelanguage.googleapis.com       │
│  └── {configured_viettel_product_api_url}            │
└──────────────────────────────────────────────────────┘
```

---

## 2. Setup & Startup Flow

### 2.1 First-time Setup

```bash
# User downloads repo (zip or git clone)
# User installs Node.js 20 LTS

# Step 1: Setup (one time)
npm run setup
# This script does:
#   1. npm install (all workspaces)
#   2. Copy config.env.example → config.env (if not exists)
#   3. Run database migrations (create tables)
#   4. Seed default data (system_config defaults)
#   5. Build frontend (next build)
#   6. Generate OpenAPI client
#   7. Print: "Setup complete! Edit config.env then run: npm start"

# Step 2: User edits config.env
# GEMINI_API_KEY=AIza...
# PORT=3000
# VIETTEL_PRODUCT_API_URL=     (empty = use built-in mock)

# Step 3: Start
npm start
# This script does:
#   1. Validate config.env (check required keys)
#   2. Start mock server (if VIETTEL_PRODUCT_API_URL is empty)
#   3. Start NestJS backend
#   4. Start Next.js frontend
#   5. Open browser to http://localhost:3000
#   6. Print: "Tool is running at http://localhost:3000"
```

### 2.2 config.env

```env
# === REQUIRED ===
GEMINI_API_KEY=your_gemini_api_key_here

# === OPTIONAL (defaults shown) ===
PORT=3000
DATA_DIR=./data

# Viettel Product API (leave empty for built-in mock)
VIETTEL_PRODUCT_API_URL=

# Processing
MAX_CONCURRENT_API_CALLS=5
API_RETRY_COUNT=3

# Display
DASHBOARD_REFRESH_SECONDS=30
```

---

## 3. Process Management

### 3.1 npm start Script

```javascript
// scripts/start.js
const { spawn } = require('child_process');

async function start() {
  // Validate config
  validateConfig();
  
  // Start processes
  const processes = [];
  
  // Mock server (if needed)
  if (!process.env.VIETTEL_PRODUCT_API_URL) {
    processes.push(spawn('node', ['packages/mock-server/dist/main.js'], {
      env: { ...process.env, PORT: '3002' }
    }));
    process.env.VIETTEL_PRODUCT_API_URL = 'http://localhost:3002';
  }
  
  // Backend
  processes.push(spawn('node', ['packages/backend/dist/main.js'], {
    env: { ...process.env, PORT: process.env.PORT || '3000' }
  }));
  
  // Frontend
  processes.push(spawn('npx', ['next', 'start', 'packages/frontend'], {
    env: { ...process.env, PORT: String((parseInt(process.env.PORT) || 3000) + 1) }
  }));
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    processes.forEach(p => p.kill());
    process.exit(0);
  });
}
```

### 3.2 Health Checks

On startup, backend verifies:
1. SQLite database accessible and migrated
2. data/ directories exist (create if not)
3. Gemini API key valid (test call with minimal input)
4. Viettel Product API reachable (GET /health or first product page)

Results stored in memory, exposed via `GET /api/health`.

---

## 4. Logging

```
data/logs/
├── app-2026-04-07.log          # Daily rotation
├── app-2026-04-06.log
└── error-2026-04-07.log        # Errors only

Log format (JSON lines):
{"ts":"2026-04-07T10:30:00Z","level":"info","module":"processing","msg":"Invoice processed","invoice_id":"abc","duration_ms":2100}
{"ts":"2026-04-07T10:30:01Z","level":"error","module":"gemini","msg":"API call failed","status":429,"retry":2}
```

Log levels: debug (dev only), info, warn, error.

Dashboard `/diagnostics` reads recent log entries via API.

---

## 5. Backup & Recovery

### MVP Strategy (manual)
- Dashboard button: "Tải backup" → downloads `database.sqlite` file
- Restore: stop server → replace sqlite file → start server
- PDF files: user responsible for folder backup

### Future consideration
- Scheduled SQLite backup (daily `.backup` command)
- Export all config (schemas, mappings) as JSON for portability

---

## 6. Update/Upgrade Path

```
# User receives new version (zip)
# 1. Stop current server (Ctrl+C)
# 2. Replace code files (keep data/ folder and config.env)
# 3. Run:
npm run setup    # re-installs deps, runs new migrations
npm start        # starts with updated code, existing data
```

Migration scripts are incremental and non-destructive. No data loss on upgrade.

---

## 7. Network Requirements

| Direction | Target | Port | Purpose |
|-----------|--------|------|---------|
| Outbound | generativelanguage.googleapis.com | 443 | Gemini API |
| Outbound | Configured Viettel Product API URL | Varies | Product sync |
| Inbound | localhost only | 3000 | Frontend + API |
| Inbound | localhost only | 3001 | Next.js dev (dev mode only) |
| Inbound | localhost only | 3002 | Mock server |

No inbound connections from external network. Firewall-friendly.

---

## 8. Disk Space Planning

| Item | Size estimate | Growth |
|------|---------------|--------|
| SQLite DB (1 year) | ~200-500 MB | ~1-2 MB/day |
| PDF uploads (1 year) | ~100-365 GB | ~0.3-1 GB/day (1000 files × 0.3-1MB avg) |
| Export files | ~50 MB | ~0.1 MB/day |
| Logs | ~1 GB | ~3 MB/day |
| Application code | ~200 MB | Static |
| **Total (1 year)** | **~100-370 GB** | |

Recommendation: 500GB available disk space. Dashboard shows disk usage alert at 80%.

---

## 9. Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20 LTS | Server runtime |
| Frontend | Next.js | 14+ | React SSR/SSG |
| UI Components | shadcn/ui + Tailwind | Latest | Component library |
| Frontend State | React Query + Zustand | Latest | Server + UI state |
| API Client | openapi-typescript-codegen | Latest | Type-safe API calls |
| Backend | NestJS | 10+ | API framework |
| ORM | Drizzle ORM | Latest | Database access |
| Database | SQLite | 3 | Data storage |
| AI/OCR | Gemini 2.0 Flash | Latest | PDF OCR + extraction |
| PDF Viewer | react-pdf / pdf.js | Latest | Inline PDF rendering |
| Package Manager | npm | 10+ | Dependency management |
| Monorepo | npm workspaces | Native | Multi-package management |
