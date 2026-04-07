---
name: BDD Test Writing
description: How to write BDD-style test specifications. ALWAYS read before RED phase.
context-load: once
---

# Skill: BDD Test Writing

## When to Use
Before implementing ANY feature. Tests MUST exist and FAIL before code is written.

## Process

1. Read the relevant section of `tasks/01-business-spec.md`
2. Read the action guide (if exists)
3. Identify ALL scenarios: happy path, edge cases, error cases
4. Write test file with describe/it blocks
5. Run tests — verify they FAIL (not implemented yet)
6. Commit: `test: add specs for [FeatureName]`

## Test Structure

```typescript
describe('FeatureName', () => {
  // Setup
  let sut: SystemUnderTest;  // "sut" = system under test
  
  beforeEach(() => {
    sut = createSut();  // Factory function, not shared mutable state
  });

  describe('methodName', () => {
    // Happy path
    it('should [expected behavior] when [condition]', () => {});

    // Edge cases (at least 2)
    it('should handle [edge case 1]', () => {});
    it('should handle [edge case 2]', () => {});

    // Error cases (at least 1)
    it('should throw [ErrorType] when [invalid condition]', () => {});
  });
});
```

## Naming Convention

```
describe('[ClassName or ModuleName]')
  describe('[methodName]')
    it('should [expected behavior] when [condition]')
```

Examples:
- `it('should return null when invoice not found')`
- `it('should throw DomainError when tax ID format invalid')`
- `it('should calculate confidence as 0.85 when frontend hint matches fingerprint')`

## Test Fixture Pattern

```typescript
// Factory function per test file — NOT shared across files
function createInvoice(overrides?: Partial<InvoiceProps>): Invoice {
  return Invoice.create({
    originalFilename: 'test.pdf',
    filePath: '/data/uploads/batch1/test.pdf',
    fileHash: 'abc123',
    fileSizeBytes: 1024,
    batchId: 'batch-1',
    ...overrides,
  });
}
```

## Domain Test (Unit — no DB, no framework)

```typescript
// Test pure domain logic
describe('FingerprintService', () => {
  const service = new FingerprintService(); // No DI needed

  it('should match schema by exact MST', () => {
    const rules = [{ schemaId: 's1', ruleType: 'mst_exact', ruleValue: '0302861742' }];
    const result = service.classify('MST: 0302861742', rules);
    expect(result.matched).toBe(true);
    expect(result.schemaId).toBe('s1');
  });
});
```

## Integration Test (Use Case — with mocked repos)

```typescript
describe('ProcessInvoiceUseCase', () => {
  let useCase: ProcessInvoiceUseCase;
  let invoiceRepo: jest.Mocked<IInvoiceRepository>;
  let ocrService: jest.Mocked<OcrService>;

  beforeEach(() => {
    invoiceRepo = { findById: jest.fn(), save: jest.fn() } as any;
    ocrService = { extract: jest.fn() } as any;
    useCase = new ProcessInvoiceUseCase(invoiceRepo, ocrService);
  });

  it('should extract and validate invoice', async () => {
    invoiceRepo.findById.mockResolvedValue(createInvoice());
    ocrService.extract.mockResolvedValue(createOcrResult());
    
    await useCase.execute('inv-1');
    
    expect(invoiceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'validated' })
    );
  });
});
```

## API Test (Controller — with supertest)

```typescript
describe('POST /api/batches', () => {
  it('should create batch and return 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/batches')
      .attach('files', Buffer.from('fake-pdf'), 'test.pdf')
      .field('uploadMode', 'specific_ncc')
      .field('hintSchemaId', 'schema-1');
    
    expect(response.status).toBe(201);
    expect(response.body.batchId).toBeDefined();
  });
});
```

## Coverage Requirements (per master plan)

| Layer | Min coverage | Focus |
|-------|-------------|-------|
| Domain entities & services | ≥ 90% | Happy path + edge cases + errors |
| Use cases | ≥ 80% | Integration with mocked deps |
| Controllers | ≥ 70% | HTTP status codes + validation |
| Frontend | Best effort | Key interactions + rendering |
