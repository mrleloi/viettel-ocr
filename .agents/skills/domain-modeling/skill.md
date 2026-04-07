---
name: Domain Modeling
description: How to implement domain entities, value objects, and domain services. Read before any domain layer work.
context-load: once
---

# Skill: Domain Modeling

## When to Use
Implementing entities, value objects, or domain services in `packages/backend/src/domain/`.

## Entity Pattern

```typescript
// Always: validate on construction, expose via getters, mutate via methods
export class Invoice {
  private constructor(private readonly props: InvoiceProps) {}

  static create(props: CreateInvoiceProps): Invoice {
    // Validation here
    if (!props.originalFilename) throw new DomainError('Filename required');
    return new Invoice({ ...props, id: props.id ?? generateId() });
  }

  static reconstitute(props: InvoiceProps): Invoice {
    // From DB — skip validation (data already validated)
    return new Invoice(props);
  }

  get id(): string { return this.props.id; }
  get status(): InvoiceStatus { return this.props.status; }

  approve(reviewedBy: string): void {
    if (this.props.status !== 'review_pending') {
      throw new DomainError('Can only approve invoices in review_pending status');
    }
    this.props.status = 'review_approved';
    this.props.reviewedBy = reviewedBy;
    this.props.reviewedAt = new Date();
  }
}
```

## Value Object Pattern

```typescript
// Immutable, equality by value, self-validating
export class TaxId {
  private constructor(readonly value: string) {}

  static create(raw: string): TaxId {
    const cleaned = raw.replace(/\s/g, '');
    if (!/^\d{10}(-\d{3})?$/.test(cleaned)) {
      throw new DomainError(`Invalid tax ID format: ${raw}`);
    }
    return new TaxId(cleaned);
  }

  equals(other: TaxId): boolean {
    return this.value === other.value;
  }
}
```

## Domain Service Pattern

```typescript
// Stateless logic that doesn't belong to a single entity
// ZERO framework imports
export class FingerprintService {
  classify(ocrText: string, rules: FingerprintRule[]): FingerprintResult {
    // Pure logic — testable without any mocks
  }
}
```

## Repository Interface Pattern

```typescript
// In domain/ — interface only, no implementation
export interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByBatchId(batchId: string): Promise<Invoice[]>;
  findDuplicate(symbol: string, number: string, sellerTaxId: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
  updateStatus(id: string, status: InvoiceStatus): Promise<void>;
}
```

## Testing Domain

```typescript
describe('Invoice', () => {
  describe('create', () => {
    it('should create with valid props', () => { /* ... */ });
    it('should throw when filename missing', () => { /* ... */ });
    it('should generate id when not provided', () => { /* ... */ });
  });

  describe('approve', () => {
    it('should transition from review_pending to review_approved', () => { /* ... */ });
    it('should throw when status is not review_pending', () => { /* ... */ });
    it('should record reviewer and timestamp', () => { /* ... */ });
  });
});
```

## Bounded Context Rules

Each bounded context folder (`domain/{context}/`) is self-contained:
- Entities reference other contexts ONLY via ID (string), never direct import
- Cross-context communication via domain events (plain objects)
- If context A needs data from context B → application layer orchestrates
