---
name: Project Scaffold
description: How to set up the monorepo from scratch. Read before Session 1.
context-load: once
---

# Skill: Project Scaffold

## Monorepo Structure

```
invoice-tool/
├── package.json              # Workspace root
├── config.env.example
├── scripts/setup.js
├── scripts/start.js
├── packages/
│   ├── shared/               # Shared types + generated API client
│   ├── backend/              # NestJS
│   ├── frontend/             # Next.js
│   └── mock-server/          # Viettel Product mock API
└── data/                     # Runtime (gitignored)
```

## Step-by-Step

### 1. Root package.json

```json
{
  "name": "invoice-tool",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "setup": "node scripts/setup.js",
    "start": "node scripts/start.js",
    "test": "npm -w packages/backend test",
    "build": "npm -w packages/backend run build && npm -w packages/frontend run build"
  }
}
```

### 2. Shared Package

```bash
mkdir -p packages/shared/src/{domain,api,constants}
```

- `src/domain/` — Value object types, entity prop types (shared between FE/BE)
- `src/api/generated/` — OpenAPI generated client (created later in Phase 3)
- `src/constants/` — Statuses, config keys, validation rules

### 3. Backend (NestJS)

```bash
cd packages && npx @nestjs/cli new backend --skip-git --package-manager npm
```

Post-scaffold:
- Enable strict mode in `tsconfig.json`
- Install drizzle-orm + better-sqlite3
- Create `src/domain/`, `src/application/`, `src/infrastructure/`, `src/interface/`
- Create database connection module
- Create config module (reads `config.env` from project root)
- Setup Jest with `--bail` default

### 4. Frontend (Next.js)

```bash
cd packages && npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-import-alias
```

Post-scaffold:
- Install shadcn/ui
- Configure API proxy to backend in `next.config.js`
- Create `src/components/`, `src/hooks/`, `src/lib/`, `src/stores/`
- Setup basic layout with sidebar placeholder

### 5. Mock Server

```bash
mkdir -p packages/mock-server/src
```

Minimal Express/Fastify server serving:
- `GET /products` — returns array of mock Viettel products
- `GET /health` — returns `{ status: 'ok' }`
- Data from `src/data/products.json` (~50 sample products)

### 6. Database Setup

```typescript
// packages/backend/src/infrastructure/database/schema.ts
// Define ALL tables from tasks/04-database-design.md using Drizzle schema builders

// packages/backend/src/infrastructure/database/connection.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

export function createDatabase(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}
```

### 7. Config Module

```typescript
// packages/backend/src/infrastructure/config/env-config.service.ts
@Injectable()
export class EnvConfigService {
  get geminiApiKey(): string { return this.get('GEMINI_API_KEY'); }
  get port(): number { return parseInt(this.get('PORT', '3000')); }
  get dataDir(): string { return this.get('DATA_DIR', './data'); }
  get viettelProductApiUrl(): string { 
    return this.get('VIETTEL_PRODUCT_API_URL', 'http://localhost:3002'); 
  }
  // ... reads from config.env using dotenv
}
```

### 8. Verify Scaffold

```bash
# Root
npm install                    # All workspaces

# Backend
cd packages/backend
npx tsc --noEmit               # Types OK
npx jest --bail                # Tests pass (may be 0 tests)

# Frontend
cd packages/frontend
npx tsc --noEmit
npx next build

# Mock server
cd packages/mock-server
node src/main.js               # Starts on :3002, responds to /products
```

## Post-Scaffold Commit

```
feat(scaffold): initialize monorepo with backend, frontend, shared, mock-server
```

## What This Session Produces
- Working monorepo with all 4 packages
- Database connection (empty tables created via migration)
- Config loader reading from config.env
- Mock server serving sample products
- Frontend with basic layout shell
- All TypeScript compiling, tests infrastructure ready
