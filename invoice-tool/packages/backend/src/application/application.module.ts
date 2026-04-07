import { Module } from '@nestjs/common';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { UploadBatchUseCase } from './upload/upload-batch.use-case';
import { ProcessInvoiceUseCase } from './processing/process-invoice.use-case';
import { ApproveInvoiceUseCase } from './review/approve-invoice.use-case';
import { RejectInvoiceUseCase } from './review/reject-invoice.use-case';
import { EditInvoiceUseCase } from './review/edit-invoice.use-case';
import { CreateSchemaUseCase } from './schema/create-schema.use-case';
import { UpdateSchemaUseCase } from './schema/update-schema.use-case';
import { SyncProductsUseCase } from './product/sync-products.use-case';
import { CreateMappingUseCase } from './mapping/create-mapping.use-case';
import { CreateExportUseCase } from './export/create-export.use-case';

/**
 * Application module — provides all use cases.
 *
 * Orchestrates domain services via DI. Imports infrastructure modules
 * for repository, queue, AI, and file storage access.
 */
@Module({
  imports: [QueueModule],
  providers: [
    UploadBatchUseCase,
    ProcessInvoiceUseCase,
    ApproveInvoiceUseCase,
    RejectInvoiceUseCase,
    EditInvoiceUseCase,
    CreateSchemaUseCase,
    UpdateSchemaUseCase,
    SyncProductsUseCase,
    CreateMappingUseCase,
    CreateExportUseCase,
  ],
  exports: [
    UploadBatchUseCase,
    ProcessInvoiceUseCase,
    ApproveInvoiceUseCase,
    RejectInvoiceUseCase,
    EditInvoiceUseCase,
    CreateSchemaUseCase,
    UpdateSchemaUseCase,
    SyncProductsUseCase,
    CreateMappingUseCase,
    CreateExportUseCase,
  ],
})
export class ApplicationModule {}
