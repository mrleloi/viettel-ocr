# 🧾 Viettel OCR — Vietnamese Invoice Processing Tool

AI-powered invoice processing tool built for Viettel, using **Gemini 2.0 Flash** for OCR and data extraction from Vietnamese invoices (hóa đơn). Automatically classifies, extracts, validates, and maps invoice data to Viettel's product catalog.

---

## ✨ Features

- **PDF Invoice Upload** — Single or batch upload with drag-and-drop
- **AI-Powered OCR** — Gemini 2.0 Flash extracts structured data from invoice images
- **Auto Classification** — Fingerprint-based and AI-based supplier recognition
- **Product Mapping** — Fuzzy matching of invoice line items to Viettel product catalog
- **Confidence Scoring** — Auto-route high-confidence invoices, flag low-confidence for review
- **Human Review Queue** — Approve, reject, or edit extracted data
- **Schema Management** — Configure extraction rules per supplier
- **Export** — CSV, JSON, XLSX export with customizable fields
- **Real-time Updates** — SSE-powered live dashboard updates
- **Diagnostics** — System health monitoring and processing statistics

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 · React 19 · Tailwind CSS · shadcn/ui |
| **Backend** | NestJS 10 · Clean Architecture · DDD |
| **Database** | SQLite (WAL mode) · Drizzle ORM |
| **AI / OCR** | Google Gemini 2.0 Flash API |
| **API Contract** | OpenAPI / Swagger · Generated TypeScript client |
| **Mock Services** | Express (Viettel Product API mock) |

---

## 📋 Prerequisites

- **Node.js 20+** — [Download here](https://nodejs.org/)
- **Gemini API Key** — [Get one from Google AI Studio](https://aistudio.google.com/apikey)
- **OS**: Windows, macOS, or Linux

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <repo-url>
cd viettel-ocr
```

### 2. Run setup

```bash
cd invoice-tool
npm run setup
```

This will:
- ✅ Check Node.js version (≥20 required)
- 📦 Install all dependencies (npm workspaces)
- 📝 Create `config.env` from template (if not exists)
- 📁 Create data directories (`data/uploads`, `data/exports`, `data/logs`, `data/db`)
- 🔨 Build the shared types package
- 🔍 Verify TypeScript compilation

### 3. Configure environment

Edit `invoice-tool/config.env`:

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

> **Tip:** If you don't have a Gemini API key yet, the app will still start — OCR features just won't work until configured.

### 4. Seed demo data (optional)

```bash
npm run seed
```

This populates the database with sample schemas (Digiworld, Samsung, FPT), products, mappings, and demo invoices so you can explore the UI immediately.

### 5. Start the application

```bash
npm start
```

This launches **three services** simultaneously:

| Service | URL | Description |
|---------|-----|-------------|
| **Backend API** | http://localhost:3000 | NestJS REST API + Swagger docs |
| **Frontend** | http://localhost:3001 | Next.js web application |
| **Mock Server** | http://localhost:3002 | Viettel Product API mock (auto-started if no external API configured) |

**Open http://localhost:3001** in your browser to use the app.

### Alternative: Dev mode (with hot-reload)

```bash
npm run dev
```

Starts all services with hot-reload enabled — recommended during development.

---

## 📂 Project Structure

```
viettel-ocr/
├── invoice-tool/                   # Monorepo root
│   ├── packages/
│   │   ├── shared/                 # Shared TypeScript types & generated API client
│   │   ├── backend/                # NestJS backend (Clean Architecture)
│   │   │   └── src/
│   │   │       ├── domain/         # Entities, Value Objects, Domain Services
│   │   │       ├── application/    # Use Cases (orchestration)
│   │   │       ├── infrastructure/ # DB repos, AI client, storage
│   │   │       └── interface/      # REST controllers, DTOs, SSE
│   │   ├── frontend/               # Next.js frontend (App Router)
│   │   │   └── src/
│   │   │       ├── app/            # Pages (dashboard, upload, review, etc.)
│   │   │       ├── components/     # Reusable UI components
│   │   │       └── lib/            # API client, hooks, utilities
│   │   └── mock-server/            # Viettel Product API mock (Express)
│   ├── scripts/                    # Setup, start, and seed scripts
│   ├── data/                       # Runtime data (gitignored)
│   │   ├── db/                     # SQLite database
│   │   ├── uploads/                # Uploaded invoice files
│   │   └── exports/                # Generated export files
│   ├── config.env                  # Environment config (gitignored)
│   └── config.env.example          # Config template
├── documents/                      # Design specs & documentation
├── tasks/                          # Action guides & session plans
└── README.md                       # ← You are here
```

---

## 🧪 Running Tests

```bash
cd invoice-tool

# Run backend tests
npm test

# Run all tests (backend + shared)
npm run test:all

# Type checking across all packages
npm run typecheck
```

---

## 📖 API Documentation (Swagger)

Once the backend is running, access the interactive API docs at:

**http://localhost:3000/api**

All endpoints are documented with request/response schemas, validation rules, and example payloads.

---

## 🔧 Available Scripts

All commands run from the `invoice-tool/` directory:

| Command | Description |
|---------|-------------|
| `npm run setup` | First-time setup (install deps, create dirs, build shared) |
| `npm start` | Start all services (backend + frontend + mock) |
| `npm run dev` | Start all services with hot-reload |
| `npm run seed` | Populate DB with demo data |
| `npm test` | Run backend tests |
| `npm run test:all` | Run all tests (backend + shared) |
| `npm run build` | Production build (shared → backend → frontend) |
| `npm run typecheck` | TypeScript type checking across all packages |
| `npm run lint` | ESLint across backend + frontend |

---

## 🏛️ Architecture

The backend follows **Clean Architecture** with strict dependency rules:

```
┌──────────────────────────────────────────┐
│  Interface Layer (controllers, DTOs, SSE) │  ← HTTP in/out
├──────────────────────────────────────────┤
│  Application Layer (use cases)            │  ← Orchestration
├──────────────────────────────────────────┤
│  Domain Layer (entities, services, repos) │  ← Business logic (PURE — zero framework deps)
├──────────────────────────────────────────┤
│  Infrastructure (DB, AI, queue, storage)  │  ← External concerns
└──────────────────────────────────────────┘

Dependency rule: outer layers depend on inner, NEVER reverse.
```

### Bounded Contexts

| Context | Responsibility |
|---------|---------------|
| **Intake** | Upload, batch creation, preprocessing, deduplication |
| **Processing** | OCR, classify, extract, validate, score, route |
| **Schema Management** | Supplier schemas, fingerprint rules, field definitions |
| **Catalog** | Viettel products, sync, mappings, fuzzy match |
| **Review** | Human review queue, approve/reject, audit trail |
| **Output** | Export (CSV/JSON/XLSX), notifications, diagnostics |

---

## 🔄 Invoice Processing Flow

```
Upload PDF → Preprocess → Dedup Check → Classify (fingerprint / AI)
  → OCR + Extract (Gemini Flash) → Validate (rules)
  → Map Products (fuzzy match) → Score Confidence
  → Route (auto-complete / review / configurator) → Export
```

---

## ❓ Troubleshooting

### `config.env not found`
Run `npm run setup` first, or manually copy `config.env.example` to `config.env`.

### Port already in use
Default ports are **3000** (backend), **3001** (frontend), **3002** (mock server). Kill existing processes or change ports in `config.env` and `packages/frontend/package.json`.

### Database errors
Delete `data/db/invoice-tool.db` and restart — a fresh database will be auto-created. Re-run `npm run seed` to restore demo data.

### TypeScript build errors
```bash
npm run build -w packages/shared    # Rebuild shared types first
npm run typecheck                   # Check for TS errors
```

---

## 📄 License

Private — Viettel internal tool.
