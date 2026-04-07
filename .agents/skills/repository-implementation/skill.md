---
name: Repository Implementation
description: How to implement Drizzle+SQLite repository that fulfills domain interface.
context-load: once
---

# Skill: Repository Implementation

## When to Use
Implementing concrete repository classes in `packages/backend/src/infrastructure/database/repositories/`.

## Pattern

```typescript
// infrastructure/database/repositories/invoice.repository.impl.ts
import { Injectable, Inject } from '@nestjs/common';
import type { DrizzleDB } from '../connection';
import type { IInvoiceRepository } from '../../../domain/invoice/invoice.repository';
import { Invoice } from '../../../domain/invoice/invoice.entity';
import { invoices } from '../schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class InvoiceRepositoryImpl implements IInvoiceRepository {
  constructor(@Inject('DB') private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Invoice | null> {
    const row = await this.db.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!row) return null;
    return Invoice.reconstitute(this.toDomain(row));
  }

  async save(invoice: Invoice): Promise<void> {
    await this.db.insert(invoices).values(this.toPersistence(invoice))
      .onConflictDoUpdate({ target: invoices.id, set: this.toPersistence(invoice) });
  }

  private toDomain(row: typeof invoices.$inferSelect): InvoiceProps {
    // Map DB row → domain props
  }

  private toPersistence(entity: Invoice): typeof invoices.$inferInsert {
    // Map domain entity → DB row
  }
}
```

## Key Rules
- toDomain / toPersistence methods handle mapping
- Entity uses `reconstitute()` (not `create()`) — skip validation for DB data
- JSON fields: parse on read, stringify on write
- Dates: ISO string in SQLite, Date object in domain

## Testing
- Integration tests with real SQLite (in-memory: `':memory:'`)
- Test: save + findById roundtrip
- Test: query filters
- Test: null handling
