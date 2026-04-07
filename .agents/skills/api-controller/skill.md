---
name: API Controller
description: How to implement NestJS controllers with Swagger/OpenAPI decorators.
context-load: once
---

# Skill: API Controller

## Pattern

```typescript
@ApiTags('Invoices')
@Controller('api/invoices')
export class InvoiceController {
  constructor(private readonly approveUseCase: ApproveInvoiceUseCase) {}

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an invoice after review' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.approveUseCase.execute({ invoiceId: id, ...dto });
  }
}
```

## Rules
- Controllers are THIN — delegate all logic to use cases
- Swagger decorators on every endpoint
- DTO classes with class-validator decorators for input validation
- Response DTOs for output shape documentation
- No business logic, no direct repo access

## DTO Pattern

```typescript
export class ApproveInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
```

## File Upload Endpoint

```typescript
@Post()
@UseInterceptors(FilesInterceptor('files', 500))
@ApiConsumes('multipart/form-data')
async createBatch(
  @UploadedFiles() files: Express.Multer.File[],
  @Body() dto: CreateBatchDto,
): Promise<BatchResponseDto> { ... }
```
