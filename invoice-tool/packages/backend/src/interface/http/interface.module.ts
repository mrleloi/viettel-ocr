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

/**
 * InterfaceModule — provides all REST controllers.
 *
 * Imports ApplicationModule for use case injection.
 * DatabaseModule is @Global(), so repository tokens are available automatically.
 * FileStorageModule imported for ExportController's direct IFileStorage dependency.
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
  ],
})
export class InterfaceModule {}
