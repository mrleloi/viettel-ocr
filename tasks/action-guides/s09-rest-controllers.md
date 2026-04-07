# Session 9: REST Controllers + DTOs + OpenAPI Spec

> Phase 3.1 — Interface Layer (API Controllers)

---

## §0 Pre-Flight Checklist

- [ ] Read `.context/session-handoff.md` — confirm 361 tests pass
- [ ] Read `.context/agent-notes.md` — note Session 8 type gotchas
- [ ] Run `cd invoice-tool/packages/backend; npx jest --bail --no-coverage` — verify green
- [ ] Confirm `npx tsc --noEmit` passes

---

## §1 Context & References

### Spec References
- `documents/06-low-level-design.md` §1 — project structure, controllers listed at lines 126-142
- `documents/05-data-flow-design.md` — all API endpoints & flows
- `documents/03-high-level-design.md` — API contract overview

### Architecture Position
```
interface/http/  ← YOU ARE HERE
  ├── Controllers (thin, delegate to use cases)
  ├── DTOs (class-validator for input, ApiProperty for docs)
  └── Response DTOs (for Swagger output shape)
```

### Existing Use Cases (10 total — ALL wired in ApplicationModule)
| Use Case | Module | DI Token |
|----------|--------|----------|
| UploadBatchUseCase | upload | Direct injection |
| ProcessInvoiceUseCase | processing | Direct injection |
| ApproveInvoiceUseCase | review | Direct injection |
| RejectInvoiceUseCase | review | Direct injection |
| EditInvoiceUseCase | review | Direct injection |
| CreateSchemaUseCase | schema | Direct injection |
| UpdateSchemaUseCase | schema | Direct injection |
| SyncProductsUseCase | product | Direct injection |
| CreateMappingUseCase | mapping | Direct injection |
| CreateExportUseCase | export | Direct injection |

### Database / Repository Read Endpoints
Some GET endpoints need direct repository access (list, get-by-id). These aren't use cases — controllers can inject repositories directly for reads.

### OS/Shell
- Windows 11, PowerShell
- Avoid `&&`, `grep -r`, bash-isms
- Test command: `cd invoice-tool\packages\backend; npx jest --bail --no-coverage`

---

## §2 Mandatory Reading

### Skills
1. **API Controller** (`skills/api-controller/skill.md`) — controller pattern, DTO pattern, file upload
2. **BDD Test Writing** (`skills/bdd-test-writing/skill.md`) — test pattern for controllers
3. **Quality Self-Check** (`skills/quality-self-check/skill.md`) — post-implementation checklist

### Workflows
1. **Implement API** (`workflows/implement-api.md`) — end-to-end controller implementation
2. **Quality Gate Pipeline** (`workflows/quality-gate-pipeline.md`) — pre-commit checks

---

## §3 Tasks

### 3.1 Create DTO Classes

All DTOs go in `src/interface/dto/`. Use `class-validator` decorators.

| DTO | Fields | Validators |
|-----|--------|-----------|
| `CreateBatchDto` | uploadMode: string, hintSchemaId?: string | @IsEnum, @IsOptional, @IsString |
| `ApproveInvoiceDto` | reviewedBy: string, notes?: string | @IsString, @IsOptional |
| `RejectInvoiceDto` | reviewedBy: string, reason: string | @IsString, @IsNotEmpty |
| `EditInvoiceDto` | changes: Record<string, unknown> | @IsObject |
| `CreateSchemaDto` | name, nccName, nccTaxId, description?, fingerprintRules?, fieldDefinitions? | @IsString, @IsOptional, @IsArray |
| `UpdateSchemaDto` | name?, description?, promptTemplate?, statusAction? | @IsOptional, @IsString, @IsEnum |
| `CreateMappingDto` | schemaId, partnerProductName, viettelProductCode, source, confidence? | @IsString, @IsEnum, @IsOptional |
| `CreateExportDto` | format: 'csv'\|'json', batchId?, schemaId?, dateFrom?, dateTo? | @IsEnum, @IsOptional, @IsString |

### 3.2 Create Response DTOs

| Response DTO | Fields |
|-------------|--------|
| `BatchResponseDto` | id, status, totalFiles, processedFiles, successFiles, errorFiles, createdAt |
| `InvoiceResponseDto` | id, batchId, status, invoiceNumber, sellerName, total, confidence, etc. |
| `SchemaResponseDto` | id, name, nccName, nccTaxId, status, description, createdAt |
| `MappingResponseDto` | id, schemaId, partnerProductName, viettelProductCode, status |
| `ExportResponseDto` | exportId, filename, recordCount, fileSizeBytes |
| `SyncResultDto` | totalFetched, created, updated, conflictsDetected |

### 3.3 Controllers

| Controller | Route Prefix | Endpoints |
|-----------|-------------|-----------|
| **BatchController** | `api/batches` | POST / (upload), GET / (list), GET /:id |
| **InvoiceController** | `api/invoices` | GET / (list+filter), GET /:id, POST /:id/approve, POST /:id/reject, PUT /:id (edit) |
| **SchemaController** | `api/schemas` | POST / (create), GET / (list), GET /:id, PUT /:id (update) |
| **MappingController** | `api/mappings` | POST / (create), GET / (list by schema) |
| **ProductController** | `api/products` | POST /sync, GET / (list) |
| **ExportController** | `api/exports` | POST / (create), GET /:id/download |
| **HealthController** | `api/health` | GET / |

### 3.4 Test Pattern (supertest)

```typescript
// Example: batch.controller.spec.ts
describe('POST /api/batches', () => {
  it('should create a batch from uploaded files');
  it('should return 400 for missing files');
  it('should return 400 for invalid upload mode');
});
```

### 3.5 Wire InterfaceModule

Create `src/interface/interface.module.ts`:
- Import ApplicationModule
- Import InfrastructureModule (for direct repo reads)
- Declare all controllers
- Export module

Update `app.module.ts` to import InterfaceModule.

---

## §4 Quality Gate

```powershell
# 1. TypeScript compilation
cd invoice-tool\packages\backend; npx tsc --noEmit

# 2. Full test suite
cd invoice-tool\packages\backend; npx jest --bail --no-coverage

# 3. Domain purity (MUST return 0 results)
Select-String -Path "src/domain/**/*.ts" -Pattern "@nestjs" -Recurse

# 4. No `any` in domain
Select-String -Path "src/domain/**/*.ts" -Pattern ": any" -Recurse
```

---

## §5 Acceptance Criteria

1. [ ] All 7 controllers exist with Swagger decorators
2. [ ] All DTOs have class-validator decorators
3. [ ] `npx tsc --noEmit` passes with 0 errors
4. [ ] Test count ≥ 380 (all pass)
5. [ ] No business logic in controllers
6. [ ] InterfaceModule registered in AppModule

---

## §6 Handoff

- Update `.context/session-handoff.md`
- Update `.context/agent-notes.md` (test count, Phase 3 progress)
- Create Session 10 action guide: `tasks/action-guides/s10-frontend-scaffold.md`
