import { Module } from '@nestjs/common';
import { ApplicationModule } from '../../application/application.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { BatchController } from './batch.controller';
import { InvoiceController } from './invoice.controller';
import { SchemaController } from './schema.controller';
import { MappingController } from './mapping.controller';
import { ProductController } from './product.controller';
import { ExportController } from './export.controller';
import { HealthController } from './health.controller';
import { EventsController } from './events.controller';
import { EventBusService } from './event-bus.service';

/**
 * InterfaceModule — provides all REST controllers and the SSE event bus.
 *
 * Imports ApplicationModule for use case injection.
 * DatabaseModule is @Global(), so repository tokens are available automatically.
 * FileStorageModule imported for ExportController's direct IFileStorage dependency.
 * EventBusService is exported so other modules can publish events.
 */
@Module({
  imports: [ApplicationModule, FileStorageModule],
  controllers: [
    HealthController,
    BatchController,
    InvoiceController,
    SchemaController,
    MappingController,
    ProductController,
    ExportController,
    EventsController,
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class InterfaceModule {}
