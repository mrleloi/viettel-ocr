import { Module } from '@nestjs/common';
import { ApplicationModule } from '../../application/application.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { BatchController } from './batch.controller';
import { InvoiceController } from './invoice.controller';
import { SchemaController } from './schema.controller';
import { MappingController } from './mapping.controller';
import { ProductController } from './product.controller';
import { ExportController } from './export.controller';
import { HealthController } from './health.controller';
import { EventsController } from './events.controller';
import { EventBusService } from './event-bus.service';
import { NotificationController } from './notification.controller';
import { QueueController } from './queue.controller';

/**
 * InterfaceModule — provides all REST controllers and the SSE event bus.
 *
 * Imports ApplicationModule for use case injection.
 * DatabaseModule is @Global(), so repository tokens are available automatically.
 * FileStorageModule imported for ExportController's direct IFileStorage dependency.
 * EventBusService is exported so other modules can publish events.
 * The string-token alias 'EventBusService' enables @Optional() injection in use cases.
 */
@Module({
  imports: [ApplicationModule, FileStorageModule, QueueModule],
  controllers: [
    HealthController,
    BatchController,
    InvoiceController,
    SchemaController,
    MappingController,
    ProductController,
    ExportController,
    EventsController,
    NotificationController,
    QueueController,
  ],
  providers: [
    EventBusService,
    { provide: 'EventBusService', useExisting: EventBusService },
  ],
  exports: [EventBusService, 'EventBusService'],
})
export class InterfaceModule {}
