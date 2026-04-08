import { Global, Module } from '@nestjs/common';
import { EnvConfigService } from '../config/env-config.service';
import { createDatabase, DATABASE_TOKEN } from './connection';
import * as path from 'path';
import * as fs from 'fs';

// Repository implementations
import { SchemaRepositoryImpl } from './repositories/schema.repository.impl';
import { FingerprintRuleRepositoryImpl } from './repositories/fingerprint-rule.repository.impl';
import { FieldDefinitionRepositoryImpl } from './repositories/field-definition.repository.impl';
import { BatchRepositoryImpl } from './repositories/batch.repository.impl';
import { ProductRepositoryImpl } from './repositories/product.repository.impl';
import { SyncConflictRepositoryImpl } from './repositories/sync-conflict.repository.impl';
import { MappingRepositoryImpl } from './repositories/mapping.repository.impl';
import { InvoiceRepositoryImpl } from './repositories/invoice.repository.impl';
import { NotificationRepositoryImpl } from './repositories/notification.repository.impl';
import { ProcessingTraceRepositoryImpl } from './repositories/processing-trace.repository.impl';

/**
 * Repository providers — map domain interface tokens to concrete implementations.
 * Use cases inject via the token string (e.g., @Inject('ISchemaRepository')).
 */
const repositoryProviders = [
  { provide: 'ISchemaRepository', useClass: SchemaRepositoryImpl },
  { provide: 'IFingerprintRuleRepository', useClass: FingerprintRuleRepositoryImpl },
  { provide: 'IFieldDefinitionRepository', useClass: FieldDefinitionRepositoryImpl },
  { provide: 'IBatchRepository', useClass: BatchRepositoryImpl },
  { provide: 'IProductRepository', useClass: ProductRepositoryImpl },
  { provide: 'ISyncConflictRepository', useClass: SyncConflictRepositoryImpl },
  { provide: 'IMappingRepository', useClass: MappingRepositoryImpl },
  { provide: 'IInvoiceRepository', useClass: InvoiceRepositoryImpl },
  { provide: 'INotificationRepository', useClass: NotificationRepositoryImpl },
  { provide: 'IProcessingTraceRepository', useClass: ProcessingTraceRepositoryImpl },
];

/**
 * Database module — provides the Drizzle DB instance and all repository implementations via DI.
 * Creates the data directory and initializes tables on startup.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (config: EnvConfigService) => {
        const dataDir = path.resolve(config.dataDir);

        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Ensure uploads and exports subdirectories exist
        const uploadsDir = path.join(dataDir, 'uploads');
        const exportsDir = path.join(dataDir, 'exports');
        const logsDir = path.join(dataDir, 'logs');
        for (const dir of [uploadsDir, exportsDir, logsDir]) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        const dbPath = path.join(dataDir, 'database.sqlite');
        console.log(`📦 Database: ${dbPath}`);

        return createDatabase(dbPath);
      },
      inject: [EnvConfigService],
    },
    ...repositoryProviders,
  ],
  exports: [DATABASE_TOKEN, ...repositoryProviders.map(p => p.provide)],
})
export class DatabaseModule {}
