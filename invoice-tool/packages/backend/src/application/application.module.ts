import { Module, forwardRef } from '@nestjs/common';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { FileStorageModule } from '../infrastructure/file-storage/file-storage.module';
import { AiModule } from '../infrastructure/ai/ai.module';
import { ExternalApiModule } from '../infrastructure/external-api/external-api.module';
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
import { CreateNotificationUseCase } from './notification/create-notification.use-case';
import { ListNotificationsUseCase } from './notification/list-notifications.use-case';
import { MarkNotificationReadUseCase } from './notification/mark-notification-read.use-case';
import { ReprocessInvoiceUseCase } from './processing/reprocess-invoice.use-case';
import { PreviewSchemaExtractionUseCase } from './schema/preview-schema-extraction.use-case';

/**
 * Application module — provides all use cases.
 *
 * Orchestrates domain services via DI. Imports infrastructure modules
 * for repository, queue, AI, file storage, and external API access.
 * Uses forwardRef to break circular dependency with QueueModule.
 */
@Module({
  imports: [
    forwardRef(() => QueueModule),
    FileStorageModule,
    AiModule,
    ExternalApiModule,
  ],
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
    CreateNotificationUseCase,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    ReprocessInvoiceUseCase,
    PreviewSchemaExtractionUseCase,
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
    CreateNotificationUseCase,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    ReprocessInvoiceUseCase,
    PreviewSchemaExtractionUseCase,
  ],
})
export class ApplicationModule {}
