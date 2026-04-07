---
name: Use Case Implementation
description: How to implement application-layer use cases.
context-load: once
---

# Skill: Use Case Implementation

## Pattern

```typescript
// application/upload/upload-batch.use-case.ts
@Injectable()
export class UploadBatchUseCase {
  constructor(
    @Inject('IBatchRepository') private readonly batchRepo: IBatchRepository,
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    private readonly fileStorage: LocalFileStorageService,
    private readonly dedupChecker: DedupCheckerService,
  ) {}

  /**
   * Create a batch from uploaded files.
   * @param input - Upload parameters including files and classification hint
   * @returns Created batch with file processing status
   */
  async execute(input: UploadBatchInput): Promise<UploadBatchOutput> {
    // 1. Create batch entity
    const batch = Batch.create({ uploadMode: input.uploadMode, ... });

    // 2. Process each file
    for (const file of input.files) {
      // Validate, hash, dedup check, create invoice record
    }

    // 3. Save
    await this.batchRepo.save(batch);

    // 4. Enqueue for processing
    // ...

    return { batchId: batch.id, totalFiles: batch.totalFiles };
  }
}
```

## Rules
- One use case = one `execute()` method
- Input/Output are DTOs (plain objects), not entities
- Orchestrate domain services + repos — don't put logic here
- Error handling: catch domain errors, translate to application errors
- Each use case has ≥1 integration test with mocked repos

## Testing

```typescript
describe('UploadBatchUseCase', () => {
  let sut: UploadBatchUseCase;
  let batchRepo: jest.Mocked<IBatchRepository>;

  beforeEach(() => {
    batchRepo = { save: jest.fn() };
    sut = new UploadBatchUseCase(batchRepo, ...);
  });

  it('should create batch with correct file count', async () => {
    const result = await sut.execute({ files: [pdf1, pdf2], uploadMode: 'mixed' });
    expect(result.totalFiles).toBe(2);
    expect(batchRepo.save).toHaveBeenCalled();
  });
});
```
